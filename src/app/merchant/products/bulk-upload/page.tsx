'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  Eye,
  ArrowRight,
  Package,
  Clock,
  TrendingUp
} from 'lucide-react';
import { CSVValidator } from '@/lib/csvValidator';
import { useBulkUpload } from '@/hooks/useBulkUpload';

interface ValidationError {
  row: number;
  type: string;
  message: string;
  field?: string;
  value?: string;
  severity: 'error' | 'warning' | 'info';
}

interface UploadSummary {
  totalRows: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
}

type UploadStep = 'upload' | 'validate' | 'preview' | 'submit' | 'complete';

export default function BulkUploadPage() {
  const { isAuthenticated, loading } = useMerchantAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationError[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { uploadCSV, generateTemplate, uploadHistory, isUploading } = useBulkUpload();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/merchant/login');
    }
  }, [isAuthenticated, loading, router]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setCurrentStep('validate');
    setIsProcessing(true);

    try {
      // Client-side validation
      const validator = new CSVValidator();
      const validation = await validator.validateFile(file);
      
      setValidationResults(validation.errors || []);
      
      if (validation.isValid) {
        // Generate preview data
        const text = await file.text();
        const lines = text.split('\n').slice(0, 6); // First 5 data rows + header
        const preview = lines.map(line => line.split(','));
        setPreviewData(preview);
        
        setCurrentStep('preview');
        toast({
          title: "File Validated Successfully",
          description: `${validation.rowCount} rows ready for upload`,
        });
      } else {
        const errorCount = validation.errors?.filter(e => e.severity === 'error').length || 0;
        toast({
          title: "Validation Issues Found",
          description: `${errorCount} errors need to be fixed before upload`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Failed",
        description: "Unable to validate the CSV file. Please check the format.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB limit
    disabled: isProcessing || isUploading
  });

  const handleSubmitUpload = async () => {
    if (!uploadedFile) return;

    setCurrentStep('submit');
    setIsProcessing(true);

    try {
      await uploadCSV(uploadedFile, {
        onProgress: setUploadProgress,
        onComplete: (result) => {
          setUploadSummary(result.summary);
          setCurrentStep('complete');
          toast({
            title: "Upload Complete",
            description: `${result.summary.successful} products uploaded successfully`,
          });
        },
        onError: (error) => {
          toast({
            title: "Upload Failed",
            description: error.message,
            variant: "destructive"
          });
          setCurrentStep('preview');
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Error",
        description: "An unexpected error occurred during upload",
        variant: "destructive"
      });
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateTemplate = async () => {
    try {
      await generateTemplate({
        templateType: 'comprehensive',
        includeVariants: true,
        includeOptionalFields: true
      });
      toast({
        title: "Template Downloaded",
        description: "CSV template has been downloaded to your device",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to generate template. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetUpload = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setValidationResults([]);
    setUploadProgress(0);
    setUploadSummary(null);
    setPreviewData([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Package className="mr-3 h-8 w-8 text-primary" />
            Bulk Product Upload
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload multiple products efficiently using CSV files
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          {currentStep !== 'upload' && (
            <Button variant="outline" onClick={resetUpload}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[
          { step: 'upload', label: 'Upload', icon: Upload },
          { step: 'validate', label: 'Validate', icon: CheckCircle },
          { step: 'preview', label: 'Preview', icon: Eye },
          { step: 'submit', label: 'Submit', icon: ArrowRight },
          { step: 'complete', label: 'Complete', icon: TrendingUp }
        ].map(({ step, label, icon: Icon }, index) => {
          const isActive = currentStep === step;
          const isCompleted = ['upload', 'validate', 'preview', 'submit'].indexOf(currentStep) > index;
          
          return (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                isActive ? 'border-primary bg-primary text-white' :
                isCompleted ? 'border-green-500 bg-green-500 text-white' :
                'border-gray-300 bg-gray-100 text-gray-400'
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${
                isActive ? 'text-primary' :
                isCompleted ? 'text-green-600' :
                'text-gray-400'
              }`}>
                {label}
              </span>
              {index < 4 && (
                <ArrowRight className="h-4 w-4 text-gray-300 mx-4" />
              )}
            </div>
          );
        })}
      </div>

      <Tabs value={currentStep} className="w-full">
        {/* Upload Step */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Drag and drop your CSV file or click to browse. Maximum file size: 50MB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                {isDragActive ? (
                  <p className="text-lg font-medium text-primary">Drop the CSV file here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Drag & drop your CSV file here, or click to select
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports CSV files up to 50MB with UTF-8 encoding
                    </p>
                  </div>
                )}
                {isProcessing && (
                  <div className="mt-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">Processing file...</p>
                  </div>
                )}
              </div>

              {/* File Requirements */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">CSV File Requirements:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Required columns: product_handle, variant_sku, variant_stock_quantity</li>
                  <li>• Optional columns: product_name, product_description, product_base_price, etc.</li>
                  <li>• UTF-8 or Latin-1 encoding</li>
                  <li>• Comma-separated values</li>
                  <li>• First row must contain column headers</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation Step */}
        <TabsContent value="validate">
          <Card>
            <CardHeader>
              <CardTitle>File Validation</CardTitle>
              <CardDescription>
                Checking your CSV file for errors and formatting issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-lg font-medium">Validating your file...</p>
                  <p className="text-sm text-gray-500">This may take a few moments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {validationResults.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        File validation completed successfully! No issues found.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Validation Results</h4>
                        <div className="flex gap-2">
                          <Badge variant="destructive">
                            {validationResults.filter(e => e.severity === 'error').length} Errors
                          </Badge>
                          <Badge variant="secondary">
                            {validationResults.filter(e => e.severity === 'warning').length} Warnings
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {validationResults.map((error, index) => (
                          <Alert key={index} variant={error.severity === 'error' ? 'destructive' : 'default'}>
                            {error.severity === 'error' ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            <AlertDescription>
                              <strong>Row {error.row}:</strong> {error.message}
                              {error.field && <span className="text-sm"> (Field: {error.field})</span>}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Step */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Preview Data</CardTitle>
              <CardDescription>
                Review the first few rows of your data before uploading
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewData.length > 0 && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          {previewData[0]?.map((header, index) => (
                            <th key={index} className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(1).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50">
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="border border-gray-300 px-3 py-2 text-sm">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-gray-600">
                      Showing first 5 rows. Total rows in file: {previewData.length - 1}
                    </p>
                    <Button onClick={handleSubmitUpload} disabled={validationResults.some(e => e.severity === 'error')}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Products
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Submit Step */}
        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Uploading Products</CardTitle>
              <CardDescription>
                Processing your CSV file and creating products...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={uploadProgress} className="w-full" />
                <div className="text-center">
                  <p className="text-lg font-medium">{uploadProgress}% Complete</p>
                  <p className="text-sm text-gray-500">
                    Please don't close this page while upload is in progress
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Complete Step */}
        <TabsContent value="complete">
          <Card>
            <CardHeader>
              <CardTitle>Upload Complete</CardTitle>
              <CardDescription>
                Your products have been processed successfully
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uploadSummary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{uploadSummary.totalRows}</div>
                      <div className="text-sm text-blue-800">Total Rows</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{uploadSummary.successful}</div>
                      <div className="text-sm text-green-800">Successful</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{uploadSummary.failed}</div>
                      <div className="text-sm text-red-800">Failed</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{uploadSummary.skipped}</div>
                      <div className="text-sm text-yellow-800">Skipped</div>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-4">
                    <Button onClick={() => router.push('/merchant/products')}>
                      <Package className="mr-2 h-4 w-4" />
                      View Products
                    </Button>
                    <Button variant="outline" onClick={resetUpload}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload More
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>
              Your recent bulk upload history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadHistory.slice(0, 5).map((upload, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{upload.filename}</p>
                      <p className="text-sm text-gray-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {new Date(upload.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={upload.status === 'completed' ? 'default' : 'secondary'}>
                    {upload.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
