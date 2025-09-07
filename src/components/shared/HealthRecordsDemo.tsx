import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Upload, Download, Plus, Calendar, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface DemoHealthRecord {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: string;
  uploader: string;
}

export default function HealthRecordsDemo() {
  const { toast } = useToast();
  const [records, setRecords] = useState<DemoHealthRecord[]>([
    {
      id: '1',
      title: 'Blood Test Results - Complete Panel',
      description: 'Complete blood count and metabolic panel from routine checkup',
      date: '2025-01-15',
      type: 'Lab Results',
      uploader: 'Dr. Johnson'
    },
    {
      id: '2',
      title: 'Chest X-Ray Report',
      description: 'Routine chest X-ray showing clear lungs',
      date: '2025-01-10',
      type: 'Imaging',
      uploader: 'Dr. Smith'
    },
    {
      id: '3',
      title: 'Medication List',
      description: 'Current prescribed medications and dosages',
      date: '2025-01-05',
      type: 'Prescription',
      uploader: 'You'
    },
    {
      id: '4',
      title: 'Blood Pressure Log',
      description: 'Daily blood pressure readings for the past month',
      date: '2025-01-01',
      type: 'Vital Signs',
      uploader: 'You'
    }
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    title: '',
    description: '',
    type: 'Lab Results'
  });

  const handleUpload = () => {
    if (!newRecord.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the record",
        variant: "destructive",
      });
      return;
    }

    const record: DemoHealthRecord = {
      id: Date.now().toString(),
      title: newRecord.title,
      description: newRecord.description,
      date: new Date().toISOString().split('T')[0],
      type: newRecord.type,
      uploader: 'You'
    };

    setRecords(prev => [record, ...prev]);
    setNewRecord({ title: '', description: '', type: 'Lab Results' });
    setIsDialogOpen(false);
    
    toast({
      title: "Success",
      description: "Health record uploaded successfully",
    });
  };

  const downloadRecord = (record: DemoHealthRecord) => {
    toast({
      title: "Download Started",
      description: `Downloading ${record.title}`,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'lab results':
        return 'bg-blue-100 text-blue-800';
      case 'imaging':
        return 'bg-green-100 text-green-800';
      case 'prescription':
        return 'bg-purple-100 text-purple-800';
      case 'vital signs':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Health Records</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Health Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={newRecord.title}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter record title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select 
                  value={newRecord.type}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full p-2 border border-input rounded-md"
                >
                  <option value="Lab Results">Lab Results</option>
                  <option value="Imaging">Imaging</option>
                  <option value="Prescription">Prescription</option>
                  <option value="Vital Signs">Vital Signs</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newRecord.description}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                />
              </div>
              <div>
                <label className="text-sm font-medium">File</label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleUpload} 
                  className="flex-1"
                >
                  Upload Record
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No health records found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Upload your first health record to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((record) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{record.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatDate(record.date)}
                      </span>
                    </div>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {record.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {record.description}
                  </p>
                )}
                
                <div className="space-y-2 mb-4">
                  <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(record.type)}`}>
                    {record.type}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Uploaded by {record.uploader}</span>
                  </div>
                </div>

                <Button
                  onClick={() => downloadRecord(record)}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}