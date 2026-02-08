import { TextBox } from "./types";

export const generateMemeCanvas = async (
    imageUrl: string,
    textBoxes: TextBox[],
    width: number,
    height: number
  ): Promise<string> => {
    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not supported");
  
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
  
    // Load and draw image
    const image = new Image();
    image.crossOrigin = "anonymous";
  
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });
  
    ctx.drawImage(image, 0, 0, width, height);
  
    // Draw text boxes
    textBoxes.forEach((box) => {
      ctx.font = `${box.fontSize}px Arial`;
      ctx.fillStyle = box.color;
      ctx.textBaseline = "top";
  
      // Add text shadow
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
  
      ctx.fillText(box.text, box.position.x, box.position.y);
    });
  
    return canvas.toDataURL("image/png");
  };