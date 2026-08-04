import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, FileImage, X, Loader2 } from 'lucide-react';

interface UploadZoneProps {
    onUploadComplete: () => void;
    onError: (message: string) => void;
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.md', '.txt'];

export default function UploadZone({ onUploadComplete, onError }: UploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadFileName, setUploadFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    }, []);

    const processFile = async (file: File) => {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            onError(`不支持的文件类型: ${extension}。支持的类型: PDF, Markdown, TXT`);
            return;
        }

        setIsUploading(true);
        setUploadFileName(file.name);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '上传失败');
            }

            const result = await response.json();
            console.log('Upload successful:', result);
            
            setUploadProgress(100);
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
                setUploadFileName('');
                onUploadComplete();
            }, 500);

        } catch (error) {
            console.error('Upload error:', error);
            onError(error instanceof Error ? error.message : '上传失败');
            setIsUploading(false);
            setUploadProgress(0);
            setUploadFileName('');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-3xl mx-auto">
                <div
                    className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
                        isDragging
                            ? 'border-teal-500 bg-teal-50 shadow-lg shadow-teal-200'
                            : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-primary-50/50'
                    } ${isUploading ? 'pointer-events-none' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.md,.txt,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.csv,.json,.xml,.html,.htm,.jpg,.jpeg,.png,.gif,.bmp,.ods,.odt"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {isUploading ? (
                        <div className="space-y-6">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 bg-teal-100 rounded-full" />
                                <Loader2 className="relative w-10 h-10 text-teal-600 animate-spin mx-auto mt-5" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold text-gray-700">{uploadFileName}</p>
                                <p className="text-sm text-gray-500 mt-1">正在处理中...</p>
                            </div>
                            <div className="w-full max-w-xs mx-auto">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">{uploadProgress}%</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                                isDragging ? 'bg-teal-100 scale-110' : 'bg-primary-100'
                            }`}>
                                <Upload className={`w-10 h-10 transition-colors duration-300 ${
                                    isDragging ? 'text-teal-600' : 'text-primary-600'
                                }`} />
                            </div>
                            
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">
                                    {isDragging ? '释放以上传文件' : '拖放文件到此处'}
                                </h3>
                                <p className="text-gray-500 mt-2">
                                    或者点击选择文件
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                                    <FileText className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-600">PDF</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                                    <FileText className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-600">Markdown</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                                    <FileImage className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-600">TXT</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
