import { ConfigService } from '@nestjs/config';
import { JinaEmbeddingService } from './src/documents/processing/jina-embedding.service.js';
import { GeminiEmbeddingService } from './src/documents/processing/gemini-embedding.service.js';
import { OpenAiEmbeddingService } from './src/documents/processing/embedding.service.js';
import * as dotenv from 'dotenv';

// Đọc file .env
dotenv.config();

async function run() {
  console.log('--- Bắt đầu test Embedding API ---');
  
  // Fake config service để lấy biến môi trường
  const config = new ConfigService();
  
  const providerName = config.get<string>('EMBEDDING_PROVIDER') || 'openai';
  console.log(`Đang sử dụng provider: ${providerName.toUpperCase()}`);

  let embeddingService;
  try {
    switch (providerName) {
      case 'jina':
        embeddingService = new JinaEmbeddingService(config);
        break;
      case 'gemini':
        embeddingService = new GeminiEmbeddingService(config);
        break;
      case 'openai':
        embeddingService = new OpenAiEmbeddingService(config);
        break;
      default:
        console.error(`Không hỗ trợ test nhanh cho provider: ${providerName}`);
        return;
    }
  } catch (error) {
    console.error('Lỗi khi khởi tạo provider (thiếu API Key?):', error);
    return;
  }
  
  const texts = ['Xin chào Docmind', 'Đây là câu thứ 2 để test batch api'];
  console.log(`\nĐang gửi ${texts.length} câu lên API...`);
  
  const t0 = Date.now();
  try {
    const vectors = await embeddingService.embedBatch(texts);
    const t1 = Date.now();
    
    console.log(`\n✅ Thành công! Thời gian: ${t1 - t0}ms`);
    console.log(`Số lượng vector trả về: ${vectors.length} (khớp với số câu đầu vào)`);
    
    vectors.forEach((vector, i) => {
      console.log(`\n- Vector [${i}]: length = ${vector.length} chiều`);
      console.log(`  Mẫu 3 giá trị đầu: [${vector[0]}, ${vector[1]}, ${vector[2]}, ...]`);
    });
  } catch (err) {
    console.error('\n❌ Có lỗi khi gọi API:', err);
  }
}

run();
