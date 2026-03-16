function trimSlash(value) {
  if (!value) {
    return value;
  }
  return value.replace(/\/+$/, "");
}

const FIXED_BASE_URL = "https://api.aidating.top";

function joinUrl(baseUrl, requestPath) {
  const base = trimSlash(baseUrl || "");
  const path = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  return `${base}${path}`;
}

function resolveBaseUrl() {
  return FIXED_BASE_URL;
}

function resolveAuthHeader({ token, tokenHead, config }) {
  const resolvedToken = token || process.env.DATING_API_TOKEN || (config && config.token);
  if (!resolvedToken) {
    throw new Error("Missing token. Run register/login first or set --token / DATING_API_TOKEN / config.token.");
  }

  const resolvedHead =
    tokenHead ||
    process.env.DATING_API_TOKEN_HEAD ||
    (config && config.tokenHead) ||
    "Bearer ";

  const tokenText = String(resolvedToken);
  if (/^Bearer\s+/i.test(tokenText) || tokenText.includes(" ")) {
    return tokenText;
  }
  return `${resolvedHead}${tokenText}`;
}

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
}

async function request({
  method,
  path,
  baseUrl,
  authHeader,
  body,
  extraHeaders
}) {
  const headers = {
    Accept: "application/json",
    ...(extraHeaders || {})
  };

  if (authHeader) {
    headers.Authorization = authHeader;
  }

  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const url = joinUrl(baseUrl, path);
  const response = await fetch(url, {
    method,
    headers,
    body: payload
  });

  const parsed = await parseResponsePayload(response);

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }

  return parsed;
}

async function requestMultipart({
  method,
  path,
  baseUrl,
  authHeader,
  formData,
  extraHeaders
}) {
  const headers = {
    Accept: "application/json",
    ...(extraHeaders || {})
  };

  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const url = joinUrl(baseUrl, path);
  const response = await fetch(url, {
    method,
    headers,
    body: formData
  });

  const parsed = await parseResponsePayload(response);

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }

  return parsed;
}

module.exports = {
  FIXED_BASE_URL,
  resolveBaseUrl,
  resolveAuthHeader,
  request,
  requestMultipart
};
