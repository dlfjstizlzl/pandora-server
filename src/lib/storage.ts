import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint = import.meta.env.VITE_MINIO_ENDPOINT as string | undefined;
const accessKey = import.meta.env.VITE_MINIO_ACCESS_KEY as string | undefined;
const secretKey = import.meta.env.VITE_MINIO_SECRET_KEY as string | undefined;

const bucketName = 'pandora-assets';

if (!endpoint || !accessKey || !secretKey) {
  // Surface a clear message in development when env vars are missing.
  console.warn('MinIO credentials are not fully configured. Check .env for VITE_MINIO_* values.');
}

export const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint,
  credentials: {
    accessKeyId: accessKey ?? '',
    secretAccessKey: secretKey ?? '',
  },
  forcePathStyle: true,
});

function createObjectKey(file: File, folder: string): string {
  const extension = file.name.split('.').pop() || 'bin';
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 10);
  const prefix = folder.replace(/^\/+|\/+$/g, '');
  return `${prefix}/${Date.now()}_${random}.${extension}`;
}

function getPublicUrl(key: string): string {
  const base = (endpoint ?? '').replace(/\/+$/, '');
  return `${base}/${bucketName}/${key}`;
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  try {
    const key = createObjectKey(file, folder);
    // Use ArrayBuffer to avoid stream reader issues on some browsers/polyfills
    const buffer = await file.arrayBuffer();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type || 'application/octet-stream',
      ContentLength: file.size,
    });

    await s3Client.send(command);
    return getPublicUrl(key);
  } catch (error) {
    console.error('File upload failed', error);
    throw new Error('Upload failed. Please try again.');
  }
}
