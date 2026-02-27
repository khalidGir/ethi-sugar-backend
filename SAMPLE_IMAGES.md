# Sample Images for Disease Detection Testing

## Overview
This document provides sample image URLs and instructions for testing the Image Disease Detection workflow in n8n.

## Sample Image Sources

### Option 1: PlantVillage Dataset (Recommended)
Download sample images from the PlantVillage dataset:
- https://github.com/spMohanty/PlantVillage-dataset
- https://www.kaggle.com/datasets/vipoooool/new-plant-diseases-dataset

### Option 2: Direct Image URLs
Use these publicly available sample images for testing:

#### Healthy Leaf
```
https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/background/00a6f46d-be81-4e60-8f3e-a7603b82d5b6.jpg
```

#### Diseased Leaf (Apple Scab)
```
https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/AppleScab/0a4f0436-535b-4a53-9c24-7c9c26cacf0b.jpg
```

#### Diseased Leaf (Tomato Late Blight)
```
https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/TomatoLateBlight/0a31318c-0e7a-47e8-a58b-d6bcb020c6a6.jpg
```

### Option 3: Rice Leaf Diseases (Similar to Sugarcane)
```
https://data.mendeley.com/datasets/fwcj7stb8r/1
```

## Testing Instructions

### Via Telegram Bot
1. Open Telegram and start a chat with @imkhalu
2. Send a photo of a plant leaf
3. The bot will:
   - Send an acknowledgment message
   - Run the disease detection via n8n webhook
   - Return the analysis results

### Via n8n Workflow Test
1. Import `workflow-3-image-disease-detection.json` into n8n
2. Activate the workflow
3. Send a photo to the Telegram bot
4. Monitor the workflow execution in n8n

### Manual Test (No Telegram)
1. Use the n8n "Test Workflow" feature
2. Send a test webhook payload with an image URL
3. Check the output in the Telegram notification node

## Expected Results

### High Confidence (>80%) - CRITICAL
- Disease clearly visible
- Incident created automatically
- Admin notified immediately

### Medium Confidence (50-80%) - WARNING
- Possible disease detected
- Recommendation provided
- User advised to monitor

### Low Confidence (<50%) - NORMAL
- No significant disease found
- Plant appears healthy
- No incident created

## Notes
- The detection uses HuggingFace API with the user-provided token
- Images should be clear, well-lit photos of plant leaves
- For sugarcane-specific testing, use images of similar grass-family plants (corn, rice, wheat)
