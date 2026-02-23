import { Router, Response } from 'express';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../config/logger';

const router = Router();

const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
const MODEL_ID = 'google/vit-base-patch16-224';

interface DiseaseAnalysisResult {
  disease: string;
  confidence: number;
  recommendation: string;
}

async function analyzePlantDisease(imageUrl: string): Promise<DiseaseAnalysisResult> {
  const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: imageUrl }),
  });

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const predictions = await response.json() as any;
  
  const topPrediction = predictions[0]?.[0] || predictions[0];
  
  const disease = topPrediction?.label || 'Unknown';
  const confidence = topPrediction?.score || 0;

  let recommendation = '';
  const diseaseLower = disease.toLowerCase();
  
  if (confidence >= 0.8) {
    if (diseaseLower.includes('rust') || diseaseLower.includes('blight')) {
      recommendation = 'Apply fungicide within 48 hours. Remove affected leaves.';
    } else if (diseaseLower.includes('mildew')) {
      recommendation = 'Apply sulfur-based fungicide. Improve air circulation.';
    } else if (diseaseLower.includes('spot')) {
      recommendation = 'Apply copper-based fungicide. Monitor closely.';
    } else {
      recommendation = 'Consult agronomist for specific treatment. Monitor daily.';
    }
  } else {
    recommendation = 'Low confidence. Manual inspection recommended.';
  }

  return {
    disease,
    confidence: Math.round(confidence * 100) / 100,
    recommendation,
  };
}

router.post('/detect', async (req: any, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return errorResponse(res, 'imageUrl is required', 'VALIDATION_ERROR', 400);
    }

    logger.info({ imageUrl }, 'Analyzing plant disease');

    const result = await analyzePlantDisease(imageUrl);

    return successResponse(res, result);
  } catch (error: any) {
    logger.error({ error }, 'Disease detection error');
    return errorResponse(res, `Detection failed: ${error.message}`);
  }
});

router.post('/telegram-detect', async (req: any, res: Response) => {
  try {
    const { photoId, chatId } = req.body;

    if (!photoId || !chatId) {
      return errorResponse(res, 'photoId and chatId are required', 'VALIDATION_ERROR', 400);
    }

    const getFileUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${photoId}`;
    const fileResponse = await fetch(getFileUrl);
    const fileData = await fileResponse.json() as any;
    
    if (!fileData.ok) {
      throw new Error('Failed to get file from Telegram');
    }

    const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
    const result = await analyzePlantDisease(imageUrl);

    const message = result.confidence >= 0.8
      ? `🦠 <b>Disease Detected!</b>\n\n<b>Disease:</b> ${result.disease}\n<b>Confidence:</b> ${(result.confidence * 100).toFixed(0)}%\n<b>Action:</b> ${result.recommendation}`
      : `✅ <b>No Significant Disease Found</b>\n\n<b>Note:</b> ${result.recommendation}`;

    const notifyUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (result.confidence >= 0.8) {
      const adminNotify = `🚨 <b>New Disease Alert</b>\n\nWorker: @${chatId}\nDisease: ${result.disease}\nConfidence: ${(result.confidence * 100).toFixed(0)}%`;
      await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.ADMIN_TELEGRAM_ID,
          text: adminNotify,
          parse_mode: 'HTML',
        }),
      });
    }

    return successResponse(res, result);
  } catch (error: any) {
    logger.error({ error }, 'Telegram disease detection error');
    return errorResponse(res, `Detection failed: ${error.message}`);
  }
});

export default router;
