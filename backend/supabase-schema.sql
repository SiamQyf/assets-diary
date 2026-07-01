-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  driveRootFolderId VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  verificationToken VARCHAR(255),
  verificationExpires BIGINT,
  resetToken VARCHAR(255),
  resetExpires BIGINT
);

-- Create folders table
CREATE TABLE folders (
  id SERIAL PRIMARY KEY,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folderId VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL,
  styles JSON DEFAULT '[]'::json,
  UNIQUE(userId, folderId)
);

-- Create styles table
CREATE TABLE styles (
  id SERIAL PRIMARY KEY,
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folderId VARCHAR(255) NOT NULL,
  styleId VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  width INT DEFAULT 0,
  height INT DEFAULT 0,
  svgData TEXT,
  pngData TEXT,
  driveSvgFileId VARCHAR(255),
  drivePngFileId VARCHAR(255),
  FOREIGN KEY(folderId) REFERENCES folders(folderId) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_folders_userId ON folders(userId);
CREATE INDEX idx_styles_userId ON styles(userId);
CREATE INDEX idx_styles_folderId ON styles(folderId);
