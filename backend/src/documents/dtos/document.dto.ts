import z from 'zod';
import { UploadDocumentMetaSchema } from '../schemas/document.schema.js';

export type UploadDocumentMetaDto = z.infer<typeof UploadDocumentMetaSchema>;
