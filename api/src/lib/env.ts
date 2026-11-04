try {
  process.loadEnvFile();
} catch {
  // sem .env: as variáveis vêm do ambiente
}

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}
