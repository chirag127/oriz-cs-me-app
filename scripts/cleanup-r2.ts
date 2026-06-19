import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const client = new S3Client({
  region: 'auto',
  ...(process.env.R2_ENDPOINT ? { endpoint: process.env.R2_ENDPOINT } : {}),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function cleanup() {
  const bucket = process.env.R2_BUCKET_NAME!;
  console.log(`🧹 Cleaning up bucket: ${bucket}...`);

  const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'posters/' }));
  
  if (list.Contents && list.Contents.length > 0) {
    const keys = list.Contents.map(obj => ({ Key: obj.Key! }));
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys }
    }));
    console.log(`✅ Deleted ${keys.length} posters.`);
  } else {
    console.log('ℹ️ No posters found to delete.');
  }
}

cleanup();
