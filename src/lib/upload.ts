import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// 验证文件类型
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, JPG, PNG, GIF)'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB 限制
  }
});

const allowedImageTypesMemory = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

const fileFilterMemory = (req: unknown, file: { mimetype: string }, cb: multer.FileFilterCallback) => {
  if (allowedImageTypesMemory.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("只允许上传图片文件 (JPEG, JPG, PNG, GIF, WEBP)"));
  }
};

/** 内存存储，适合 AI 图生文等不落盘场景；单文件最大 5MB */
export const uploadImageMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilterMemory,
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});
