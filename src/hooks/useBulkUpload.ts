import { useState, useCallback, useEffect } from 'react';
import { useMerchantAuth } from '@/contexts/MerchantAuthContext';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (result: BulkUploadResult) => void;
  onError?: (error: Error) => void;
  validateOnly?: boolean;
  autoApprove?: boolean;
}

interface BulkUploadResult {
  uploadId: string;
  summary: {
    totalRows: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  errors: Array<{
    row: number;
    type: string;
    message: string;
    field?: string;
    value?: string;
  }>;
  processedAt: string;
}

interface UploadSession {
  sessionId: string;
  filename: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  summary?: BulkUploadResult['summary'];
  createdAt: string;
  completedAt?: string;
}

interface TemplateOptions {
  templateType: 'basic' | 'comprehensive' | 'variants-only';
  includeVariants?: boolean;
  includeOptionalFields?: boolean;
  categories?: string[];
  sampleData?: boolean;
}

export function useBulkUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadSession[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const { authenticatedRequest } = useMerchantAuth();

  // Load upload history on mount
  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = useCallback(async () => {
    try {
      const response = await authenticatedRequest('/api/merchant/bulk-upload/history', {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        setUploadHistory(data.uploads || []);
      }
    } catch (error) {
      console.error('Failed to load upload history:', error);
    }
  }, [authenticatedRequest]);

  const estimateRowCount = useCallback(async (file: File): Promise<number> => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      return Math.max(0, lines.length - 1); // Subtract header row
    } catch {
      return 0;
    }
  }, []);

  const createUploadSession = useCallback(async (
    filename: string,
    fileSize: number,
    expectedRows: number
  ): Promise<string> => {
    const response = await authenticatedRequest('/api/merchant/bulk-upload/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        fileSize,
        expectedRows
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create upload session');
    }

    const session = await response.json();
    return session.sessionId;
  }, [authenticatedRequest]);

  const uploadCSV = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ) => {
    setIsUploading(true);
    setCurrentUploadId(null);

    try {
      // Estimate row count
      const expectedRows = await estimateRowCount(file);

      // Create upload session
      const sessionId = await createUploadSession(file.name, file.size, expectedRows);
      setCurrentUploadId(sessionId);

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('options', JSON.stringify({
        validateOnly: options.validateOnly || false,
        autoApprove: options.autoApprove || false
      }));

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      return new Promise<BulkUploadResult>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            options.onProgress?.(progress);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              
              // Update upload history
              await loadUploadHistory();
              
              options.onComplete?.(result);
              resolve(result);
            } catch (error) {
              const parseError = new Error('Failed to parse upload response');
              options.onError?.(parseError);
              reject(parseError);
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              const error = new Error(errorData.error || `Upload failed with status ${xhr.status}`);
              options.onError?.(error);
              reject(error);
            } catch {
              const error = new Error(`Upload failed with status ${xhr.status}`);
              options.onError?.(error);
              reject(error);
            }
          }
        });

        xhr.addEventListener('error', () => {
          const error = new Error('Network error during upload');
          options.onError?.(error);
          reject(error);
        });

        xhr.addEventListener('timeout', () => {
          const error = new Error('Upload timeout');
          options.onError?.(error);
          reject(error);
        });

        // Get auth token for the request
        const token = localStorage.getItem('merchantToken');
        xhr.open('POST', '/api/merchant/bulk-upload/process');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.timeout = 300000; // 5 minutes timeout
        xhr.send(formData);
      });

    } catch (error) {
      const uploadError = error instanceof Error ? error : new Error('Upload failed');
      options.onError?.(uploadError);
      throw uploadError;
    } finally {
      setIsUploading(false);
      setCurrentUploadId(null);
    }
  }, [authenticatedRequest, estimateRowCount, createUploadSession, loadUploadHistory]);

  const getUploadStatus = useCallback(async (sessionId: string) => {
    try {
      const response = await authenticatedRequest(`/api/merchant/bulk-upload/status/${sessionId}`, {
        method: 'GET'
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get upload status:', error);
      return null;
    }
  }, [authenticatedRequest]);

  const generateTemplate = useCallback(async (options: TemplateOptions) => {
    try {
      const response = await authenticatedRequest('/api/merchant/bulk-upload/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error('Failed to generate template');
      }

      // Handle file download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `taic-product-template-${options.templateType}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Template generation failed:', error);
      throw error;
    }
  }, [authenticatedRequest]);

  const cancelUpload = useCallback(async (sessionId: string) => {
    try {
      const response = await authenticatedRequest(`/api/merchant/bulk-upload/cancel/${sessionId}`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadUploadHistory();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to cancel upload:', error);
      return false;
    }
  }, [authenticatedRequest, loadUploadHistory]);

  const retryUpload = useCallback(async (sessionId: string) => {
    try {
      const response = await authenticatedRequest(`/api/merchant/bulk-upload/retry/${sessionId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        await loadUploadHistory();
        return result;
      }
      return null;
    } catch (error) {
      console.error('Failed to retry upload:', error);
      return null;
    }
  }, [authenticatedRequest, loadUploadHistory]);

  const getUploadErrors = useCallback(async (sessionId: string) => {
    try {
      const response = await authenticatedRequest(`/api/merchant/bulk-upload/errors/${sessionId}`, {
        method: 'GET'
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get upload errors:', error);
      return null;
    }
  }, [authenticatedRequest]);

  const exportErrorReport = useCallback(async (sessionId: string) => {
    try {
      const response = await authenticatedRequest(`/api/merchant/bulk-upload/errors/${sessionId}/export`, {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `upload-errors-${sessionId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to export error report:', error);
      return false;
    }
  }, [authenticatedRequest]);

  return {
    // State
    isUploading,
    uploadHistory,
    currentUploadId,

    // Actions
    uploadCSV,
    generateTemplate,
    cancelUpload,
    retryUpload,
    getUploadStatus,
    getUploadErrors,
    exportErrorReport,
    loadUploadHistory,

    // Utilities
    estimateRowCount
  };
}
