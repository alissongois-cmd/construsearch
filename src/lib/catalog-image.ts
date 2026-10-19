import sharp from "sharp";
export async function convertCatalogImage(input:Buffer) {
  const meta=await sharp(input,{limitInputPixels:40_000_000}).metadata();
  if(!["jpeg","png","webp"].includes(meta.format||""))throw new Error("Use JPG, PNG ou WebP.");
  const output=await sharp(input,{limitInputPixels:40_000_000}).rotate().resize({width:800,height:800,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
  if(output.length>2*1024*1024)throw new Error("Imagem convertida excede 2 MB.");
  return output;
}
