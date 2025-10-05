import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import config from '../../config';

// Configure DigitalOcean Spaces
const s3 = new S3Client({
  region: 'nyc3',
  endpoint: config.s3.do_space_endpoint,
  credentials: {
    accessKeyId: config.s3.do_space_accesskey || '', // Ensure this is never undefined
    secretAccessKey: config.s3.do_space_secret_key || '', // Ensure this is never undefined
  },
});

// export const deleteFileFromSpace = async (fileUrl: string) => {
//   if (!process.env.DO_SPACE_BUCKET) {
//     throw new Error('DO_SPACE_BUCKET is not defined in the environment variables.');
//   }

//   // Example URL: https://my-bucket.nyc3.digitaloceanspaces.com/folder/12345_image.png
//   const url = new URL(fileUrl);
//   const key = url.pathname.substring(1); // remove leading "/"

//   const params = {
//     Bucket: process.env.DO_SPACE_BUCKET,
//     Key: key,
//   };

//   try {
//     await s3.send(new DeleteObjectCommand(params));
//     console.log(`Deleted file: ${key}`);
//   } catch (error) {
//     console.error('Error deleting file:', error);
//     throw error;
//   }
// };


export const deleteFileFromSpace = async (fileUrl: string) => {
  if (!process.env.DO_SPACE_BUCKET) {
    throw new Error('DO_SPACE_BUCKET is not defined');
  }

  try {
    const url = new URL(fileUrl);
    const key = decodeURIComponent(url.pathname.substring(1)); // safer decode

    const params = {
      Bucket: process.env.DO_SPACE_BUCKET,
      Key: key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`✅ Deleted file from Space: ${key}`);
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    throw error;
  }
};
