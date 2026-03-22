/**
 * Image Compression Utility
 *
 * Compresses images to meet Claude API's 5MB limit
 * Uses canvas to resize and compress images before sending
 */

/**
 * Compress an image to fit within the specified size limit
 * @param {string} base64Image - Base64 encoded image (data:image/png;base64,...)
 * @param {number} maxSizeBytes - Maximum size in bytes (default: 4.5MB to be safe)
 * @param {number} quality - JPEG quality 0-1 (default: 0.8)
 * @param {number} maxDimension - Maximum width/height in pixels (default: 2048)
 * @returns {Promise<string>} - Compressed base64 image
 */
export async function compressImage(
  base64Image,
  maxSizeBytes = 4.5 * 1024 * 1024, // 4.5MB (safe margin below 5MB)
  quality = 0.8,
  maxDimension = 2048
) {
  return new Promise((resolve, reject) => {
    // Create an image element
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with compression (JPEG is much smaller than PNG)
        let compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        // Check size and reduce quality if still too large
        let currentSize = getBase64Size(compressedBase64);
        let currentQuality = quality;

        while (currentSize > maxSizeBytes && currentQuality > 0.1) {
          currentQuality -= 0.1;
          compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality);
          currentSize = getBase64Size(compressedBase64);
          console.log(`Compressing image: quality=${currentQuality.toFixed(1)}, size=${(currentSize / 1024 / 1024).toFixed(2)}MB`);
        }

        // If still too large, reduce dimensions
        if (currentSize > maxSizeBytes) {
          const scaleFactor = Math.sqrt(maxSizeBytes / currentSize);
          const newWidth = Math.floor(width * scaleFactor);
          const newHeight = Math.floor(height * scaleFactor);

          canvas.width = newWidth;
          canvas.height = newHeight;
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

          console.log(`Reduced dimensions: ${width}x${height} -> ${newWidth}x${newHeight}`);
        }

        const finalSize = getBase64Size(compressedBase64);
        console.log(`✅ Image compressed: ${(getBase64Size(base64Image) / 1024 / 1024).toFixed(2)}MB -> ${(finalSize / 1024 / 1024).toFixed(2)}MB`);

        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = base64Image;
  });
}

/**
 * Calculate the size of a base64 encoded string in bytes
 * @param {string} base64 - Base64 string
 * @returns {number} - Size in bytes
 */
export function getBase64Size(base64) {
  // Remove data URL prefix if present
  const base64String = base64.split(',')[1] || base64;

  // Calculate size: base64 encoding adds ~33% overhead
  // Actual size = (base64 length * 3) / 4
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}

/**
 * Check if an image needs compression
 * @param {string} base64Image - Base64 encoded image
 * @param {number} maxSizeBytes - Maximum size in bytes
 * @returns {boolean} - True if compression needed
 */
export function needsCompression(base64Image, maxSizeBytes = 5 * 1024 * 1024) {
  return getBase64Size(base64Image) > maxSizeBytes;
}

export default {
  compressImage,
  getBase64Size,
  needsCompression
};
