export const getEnvVar = (key: string): string | undefined => {
  // In browser, only access NEXT_PUBLIC_ prefixed variables
  if (typeof window !== 'undefined') {
    return process.env[`NEXT_PUBLIC_${key}`] || process.env[key];
  }
  
  // In Node.js, access any environment variable
  return process.env[key];
};

export const requireEnvVar = (key: string): string => {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
};