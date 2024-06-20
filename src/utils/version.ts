import fs from "fs";

export function getLocalVersion(): string | null {
  try {
    // Caminho para o arquivo package.json
    const packageJsonPath = "./package.json";

    // Carregar o conteúdo do arquivo package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");

    // Converter o conteúdo para um objeto JSON
    const packageJson = JSON.parse(packageJsonContent);

    // Retornar a versão do pacote
    return packageJson.version;
  } catch (error: any) {
    console.error("Error reading local package.json:", error.message);
    return null;
  }
}

async function getJsonFromUrl(url: string): Promise<any> {
  try {
    // Importação dinâmica do módulo node-fetch
    const fetch = await import("node-fetch");

    const response = await fetch.default(url); // Acesso ao método default de fetch
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const json = await response.json();
    return json;
  } catch (error: any) {
    console.error("Error fetching JSON:", error.message);
    throw error;
  }
}

export async function fetchVersionJson(): Promise<any> {
  try {
    const versionUrl =
      "https://raw.githubusercontent.com/juniorkrz/stickerbot/main/package.json"; // don't change it
    const json = await getJsonFromUrl(versionUrl);
    return json;
  } catch (error: any) {
    console.error("Error fetching version JSON:", error.message);
    return null;
  }
}
