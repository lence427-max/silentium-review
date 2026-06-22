export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export async function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('单张图片过大，请先裁剪或压缩后再上传');
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(imageUrl);
    const scale = image.width > maxWidth ? maxWidth / image.width : 1;
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器无法处理图片');
    context.drawImage(image, 0, 0, width, height);
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, type, quality);
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片压缩失败'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}
