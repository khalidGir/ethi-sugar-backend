import { Router, Response } from 'express';
import { getWeatherForecast, getCurrentWeather } from '../../services/weather';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../config/logger';

const router = Router();

router.get('/forecast', async (req, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 3;
    const forecast = await getWeatherForecast(days);
    return successResponse(res, forecast);
  } catch (error) {
    logger.error({ error }, 'Error fetching weather forecast');
    return errorResponse(res, 'Failed to fetch weather forecast');
  }
});

router.get('/current', async (req, res: Response) => {
  try {
    const current = await getCurrentWeather();
    return successResponse(res, current);
  } catch (error) {
    logger.error({ error }, 'Error fetching current weather');
    return errorResponse(res, 'Failed to fetch current weather');
  }
});

export default router;
