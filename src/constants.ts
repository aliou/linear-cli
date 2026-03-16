declare const BUILD_VERSION: string | undefined;

export const APP_NAME = "linear";
export const VERSION =
  typeof BUILD_VERSION === "string" ? BUILD_VERSION : "0.0.0-dev";

export const LINEAR_API_URL = "https://api.linear.app/graphql";
export const CONFIG_FILE = "config.json";
