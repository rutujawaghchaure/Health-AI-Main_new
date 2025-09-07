import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Signal =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: 'leave' };

export default function Consultation() {
  const { profile, user } = useAuth();
  const [params] = useSearchParams();
  const appointmentId = params.get('appointmentId');
  const [appointment, setAppointment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!appointmentId) return;
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();
      setAppointment(data || null);
      setLoading(false);
    };
    load();
  }, [appointmentId]);

  const canStart = useMemo(() => {
    if (!appointment) return false;
    const start = new Date(appointment.appointment_date).getTime();
    const approved = (appointment.approval_status || 'pending') === 'approved';
    return now >= start && approved;
  }, [appointment, now]);

  const setupPeer = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302'
        ] }
      ]
    });
    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current) {
        const payload: Signal = {
          type: 'ice',
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex
        };
        channelRef.current.send({ type: 'broadcast', event: 'signal', payload });
      }
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === 'connected');
    };
    pcRef.current = pc;
    return pc;
  };

  const attachLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    const pc = pcRef.current!;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  };

  const join = async () => {
    if (!appointmentId || !profile) return;
    setError(null);
    setJoining(true);
    try {
      const pc = setupPeer();

      const channel = supabase.channel(`consultation:${appointmentId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user?.id || Math.random().toString() }
        }
      });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
        if (!pcRef.current) return;
        try {
          if (payload.type === 'offer') {
            await pcRef.current.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
            await attachLocalStream();
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            const signal: Signal = { type: 'answer', sdp: answer.sdp! };
            channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: signal });
          } else if (payload.type === 'answer') {
            if (!pcRef.current.currentRemoteDescription) {
              await pcRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
            }
          } else if (payload.type === 'ice') {
            await pcRef.current.addIceCandidate({
              candidate: payload.candidate,
              sdpMid: payload.sdpMid || undefined,
              sdpMLineIndex: payload.sdpMLineIndex || undefined
            });
          } else if (payload.type === 'leave') {
            endCall();
          }
        } catch (err) {
          console.error('Signal handling error', err);
          setError('Connection error during signaling');
        }
      });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const isCaller = profile.role === 'patient';
          if (isCaller) {
            await attachLocalStream();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const signal: Signal = { type: 'offer', sdp: offer.sdp! };
            channel.send({ type: 'broadcast', event: 'signal', payload: signal });
          }
        }
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to start call');
      setJoining(false);
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted(!muted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCameraOff(!cameraOff);
  };

  const endCall = () => {
    pcRef.current?.getSenders().forEach((s) => s.track && s.track.stop());
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { type: 'leave' } as Signal });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    setJoining(false);
  };

  useEffect(() => {
    return () => {
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Video Consultation</CardTitle>
            <CardDescription>
              {appointment ? `Scheduled: ${new Date(appointment.appointment_date).toLocaleString()}` : '—'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading consultation...</div>
            ) : !appointment ? (
              <div className="text-sm text-gray-500">Appointment not found.</div>
            ) : (
              <div className="space-y-4">
                {!canStart && (
                  <div className="text-sm text-gray-600">
                    {appointment.approval_status !== 'approved'
                      ? 'Waiting for doctor approval.'
                      : 'Starts at scheduled time.'}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="aspect-video bg-black rounded overflow-hidden">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                  <div className="aspect-video bg-black rounded overflow-hidden">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                </div>

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex items-center gap-2">
                  <Button onClick={join} disabled={!canStart || joining || connected}>
                    {connected ? 'Connected' : joining ? 'Connecting...' : 'Join Call'}
                  </Button>
                  <Button variant="outline" onClick={toggleMute} disabled={!localStreamRef.current}>
                    {muted ? 'Unmute' : 'Mute'}
                  </Button>
                  <Button variant="outline" onClick={toggleCamera} disabled={!localStreamRef.current}>
                    {cameraOff ? 'Camera On' : 'Camera Off'}
                  </Button>
                  <Button variant="destructive" onClick={endCall} disabled={!localStreamRef.current && !channelRef.current}>
                    Leave
                  </Button>
                </div>

                <div className="text-xs text-gray-500">Calls are peer-to-peer via WebRTC with Supabase Realtime signaling.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 




// import React, { useEffect, useRef, useState } from "react";
// import { db } from "@/integrations/firebase/client";
// import {
//   collection,
//   doc,
//   addDoc,
//   setDoc,
//   onSnapshot,
// } from "firebase/firestore";

// type Props = {
//   appointmentId: string;
//   isDoctor: boolean;
// };

// export default function Consultation() {
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const [params] = useSearchParams();
//   const appointmentId = params.get('appointmentId');
//   const pcRef = useRef<RTCPeerConnection | null>(null);
//   const localStreamRef = useRef<MediaStream | null>(null);
//   const remoteStreamRef = useRef<MediaStream | null>(null);

//   const [callStarted, setCallStarted] = useState(false);
//   const [timer, setTimer] = useState(0);
//   const [muted, setMuted] = useState(false);
//   const [cameraOn, setCameraOn] = useState(true);

//   const servers = {
//     iceServers: [
//       { urls: "stun:stun.l.google.com:19302" },
//       {
//         urls: "turn:openrelay.metered.ca:80",
//         username: "openrelayproject",
//         credential: "openrelayproject",
//       },
//     ],
//   };

//   // ⏱ Timer
//   useEffect(() => {
//     let interval: any;
//     if (callStarted) {
//       interval = setInterval(() => setTimer((t) => t + 1), 1000);
//     }
//     return () => clearInterval(interval);
//   }, [callStarted]);

//   const startLocalStream = async () => {
//     const localStream = await navigator.mediaDevices.getUserMedia({
//       video: true,
//       audio: true,
//     });
//     localStreamRef.current = localStream;
//     if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
//     return localStream;
//   };

//   // 🟢 Doctor creates room
//   const createRoom = async () => {
//     const roomRef = doc(db, "rooms", appointmentId); // use appointmentId as roomId
//     pcRef.current = new RTCPeerConnection(servers);

//     const localStream = await startLocalStream();
//     localStream.getTracks().forEach((t) => pcRef.current?.addTrack(t, localStream));

//     const remoteStream = new MediaStream();
//     remoteStreamRef.current = remoteStream;
//     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
//     pcRef.current.ontrack = (event) => {
//       event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
//     };

//     // Create offer
//     const offer = await pcRef.current.createOffer();
//     await pcRef.current.setLocalDescription(offer);
//     await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

//     // ICE
//     const callerCandidates = collection(roomRef, "callerCandidates");
//     pcRef.current.onicecandidate = async (e) => {
//       if (e.candidate) await addDoc(callerCandidates, e.candidate.toJSON());
//     };

//     // Listen for answer
//     onSnapshot(roomRef, async (snapshot) => {
//       const data = snapshot.data();
//       if (data?.answer && !pcRef.current?.currentRemoteDescription) {
//         await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
//         setCallStarted(true);
//       }
//     });

//     // Listen for callee ICE
//     onSnapshot(collection(roomRef, "calleeCandidates"), (snapshot) => {
//       snapshot.docChanges().forEach((c) => {
//         if (c.type === "added") {
//           pcRef.current?.addIceCandidate(new RTCIceCandidate(c.doc.data()));
//         }
//       });
//     });
//   };

//   // 🟢 Patient joins room automatically
//   const joinRoom = async () => {
//     const roomRef = doc(db, "rooms", appointmentId);
//     pcRef.current = new RTCPeerConnection(servers);

//     const localStream = await startLocalStream();
//     localStream.getTracks().forEach((t) => pcRef.current?.addTrack(t, localStream));

//     const remoteStream = new MediaStream();
//     remoteStreamRef.current = remoteStream;
//     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
//     pcRef.current.ontrack = (e) => {
//       e.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
//     };

//     const calleeCandidates = collection(roomRef, "calleeCandidates");
//     pcRef.current.onicecandidate = async (e) => {
//       if (e.candidate) await addDoc(calleeCandidates, e.candidate.toJSON());
//     };

//     // Get offer
//     onSnapshot(roomRef, async (snapshot) => {
//       const data = snapshot.data();
//       if (data?.offer && !pcRef.current?.currentRemoteDescription) {
//         await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.offer));
//         const answer = await pcRef.current.createAnswer();
//         await pcRef.current.setLocalDescription(answer);
//         await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
//         setCallStarted(true);
//       }
//     });

//     // Caller ICE
//     onSnapshot(collection(roomRef, "callerCandidates"), (snapshot) => {
//       snapshot.docChanges().forEach((c) => {
//         if (c.type === "added") {
//           pcRef.current?.addIceCandidate(new RTCIceCandidate(c.doc.data()));
//         }
//       });
//     });
//   };

//   // 🔴 End call
//   const endCall = () => {
//     pcRef.current?.close();
//     localStreamRef.current?.getTracks().forEach((t) => t.stop());
//     setCallStarted(false);
//   };

//   // 🎙 Mute / 🎥 Camera toggle
//   const toggleMute = () => {
//     const audioTrack = localStreamRef.current?.getAudioTracks()[0];
//     if (audioTrack) {
//       audioTrack.enabled = !audioTrack.enabled;
//       setMuted(!audioTrack.enabled);
//     }
//   };

//   const toggleCamera = () => {
//     const videoTrack = localStreamRef.current?.getVideoTracks()[0];
//     if (videoTrack) {
//       videoTrack.enabled = !videoTrack.enabled;
//       setCameraOn(videoTrack.enabled);
//     }
//   };

//   return (
//     <div className="p-4">
//       <div className="grid grid-cols-2 gap-4">
//         <video ref={localVideoRef} autoPlay playsInline muted />
//         <video ref={remoteVideoRef} autoPlay playsInline />
//       </div>

//       <div className="mt-4 flex gap-2">
//         {isDoctor ? (
//           <button onClick={createRoom}>Start Consultation</button>
//         ) : (
//           <button onClick={joinRoom}>Join Consultation</button>
//         )}
//         {callStarted && (
//           <>
//             <button onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
//             <button onClick={toggleCamera}>{cameraOn ? "Camera Off" : "Camera On"}</button>
//             <button onClick={endCall}>End Call</button>
//             <p>⏱ {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</p>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }
