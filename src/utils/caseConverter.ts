// utils/caseConverter.ts

//CamelCase 변환 함수
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

// 객체의 모든 키를 CamelCase로 변환하는 함수
export function convertKeysToCamel<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamel(item)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = toCamelCase(key);
      acc[camelKey] = convertKeysToCamel(obj[key]);
      return acc;
    }, {} as any);
  }

  return obj;
}

// SnakeCase 변환 함수
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase();
}

// 객체의 모든 키를 SnakeCase로 변환하는 함수
export function convertKeysToSnake<T>(obj: any): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToSnake(item)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = toSnakeCase(key);
      acc[snakeKey] = convertKeysToSnake(obj[key]);
      return acc;
    }, {} as any);
  }

  return obj;
}