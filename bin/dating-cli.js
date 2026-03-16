#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const {
  resolveConfigPath,
  readConfig,
  mergeConfig,
  writeConfig
} = require("../lib/config");
const {
  FIXED_BASE_URL,
  resolveBaseUrl,
  resolveAuthHeader,
  request,
  requestMultipart
} = require("../lib/client");
const { version: packageVersion } = require("../package.json");

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function optionalText(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

function assignDefined(target, key, value) {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
}

function collectRepeat(value, previous) {
  const next = Array.isArray(previous) ? previous : [];
  next.push(value);
  return next;
}

function parseKeyValuePairs(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const result = {};
  for (const raw of values) {
    const text = optionalText(raw);
    if (!text) {
      continue;
    }
    const idx = text.indexOf("=");
    if (idx <= 0) {
      throw new Error(`${label} must use key=value format`);
    }
    const key = text.slice(0, idx).trim();
    const val = text.slice(idx + 1).trim();
    if (!key || !val) {
      throw new Error(`${label} must use non-empty key and value`);
    }
    result[key] = val;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseJsonObject(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function parseInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

function parseLong(value, label) {
  return parseInteger(value, label);
}

function parseDecimal(value, label) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a number`);
  }
  return parsed;
}

function parseOptionalInteger(value, label) {
  const text = optionalText(value);
  if (text === undefined) {
    return undefined;
  }
  return parseInteger(text, label);
}

function parseOptionalLong(value, label) {
  const text = optionalText(value);
  if (text === undefined) {
    return undefined;
  }
  return parseLong(text, label);
}

function parseOptionalDecimal(value, label) {
  const text = optionalText(value);
  if (text === undefined) {
    return undefined;
  }
  return parseDecimal(text, label);
}

function parseOptionalFilterExpression(value, label) {
  const text = optionalText(value);
  if (text === undefined) {
    return undefined;
  }
  return parseJsonObject(text, label);
}

function buildProfileUpdateBody(opts) {
  const body = {};
  const photoUrls = Array.isArray(opts.photoUrl)
    ? Array.from(
        new Set(
          opts.photoUrl
            .map((item) => optionalText(item))
            .filter((item) => item !== undefined)
        )
      )
    : undefined;
  assignDefined(body, "gender", optionalText(opts.gender));
  assignDefined(body, "birthday", optionalText(opts.birthday));
  assignDefined(body, "heightCm", parseOptionalInteger(opts.heightCm, "height-cm"));
  assignDefined(body, "weightKg", parseOptionalInteger(opts.weightKg, "weight-kg"));
  assignDefined(body, "annualIncomeCny", parseOptionalLong(opts.annualIncomeCny, "annual-income-cny"));
  assignDefined(body, "characterText", optionalText(opts.characterText));
  assignDefined(body, "hobbyText", optionalText(opts.hobbyText));
  assignDefined(body, "abilityText", optionalText(opts.abilityText));
  assignDefined(body, "major", optionalText(opts.major));
  assignDefined(body, "nationality", optionalText(opts.nationality));
  assignDefined(body, "country", optionalText(opts.country));
  assignDefined(body, "province", optionalText(opts.province));
  assignDefined(body, "city", optionalText(opts.city));
  assignDefined(body, "addressDetail", optionalText(opts.addressDetail));
  assignDefined(body, "currentLatitude", parseOptionalDecimal(opts.currentLatitude, "current-latitude"));
  assignDefined(body, "currentLongitude", parseOptionalDecimal(opts.currentLongitude, "current-longitude"));
  assignDefined(body, "currentLocationText", optionalText(opts.currentLocationText));
  assignDefined(body, "photoUrls", photoUrls && photoUrls.length > 0 ? photoUrls : undefined);
  assignDefined(body, "email", optionalText(opts.email));
  assignDefined(body, "phone", optionalText(opts.phone));
  assignDefined(body, "telegram", optionalText(opts.telegram));
  assignDefined(body, "wechat", optionalText(opts.wechat));
  assignDefined(body, "whatsapp", optionalText(opts.whatsapp));
  assignDefined(body, "signal_chat", optionalText(opts.signalChat));
  assignDefined(body, "line", optionalText(opts.line));
  assignDefined(body, "snapchat", optionalText(opts.snapchat));
  assignDefined(body, "instagram", optionalText(opts.instagram));
  assignDefined(body, "facebook", optionalText(opts.facebook));
  assignDefined(body, "otherContacts", parseKeyValuePairs(opts.otherContact, "other-contact"));

  if (Object.keys(body).length === 0) {
    throw new Error("Missing profile fields. Provide direct options such as --gender, --city, --character-text.");
  }
  return body;
}

function buildTaskCriteriaFromOptions(opts) {
  const criteria = {};
  assignDefined(criteria, "preferredGenderFilter", parseOptionalFilterExpression(opts.preferredGenderFilter, "preferred-gender-filter"));
  assignDefined(criteria, "preferredHeightFilter", parseOptionalFilterExpression(opts.preferredHeightFilter, "preferred-height-filter"));
  assignDefined(criteria, "preferredIncomeFilter", parseOptionalFilterExpression(opts.preferredIncomeFilter, "preferred-income-filter"));
  assignDefined(criteria, "preferredCityFilter", parseOptionalFilterExpression(opts.preferredCityFilter, "preferred-city-filter"));
  assignDefined(criteria, "preferredNationalityFilter", parseOptionalFilterExpression(opts.preferredNationalityFilter, "preferred-nationality-filter"));
  assignDefined(criteria, "preferredEducationFilter", parseOptionalFilterExpression(opts.preferredEducationFilter, "preferred-education-filter"));
  assignDefined(criteria, "preferredOccupationFilter", parseOptionalFilterExpression(opts.preferredOccupationFilter, "preferred-occupation-filter"));
  assignDefined(criteria, "preferredEducationStage", optionalText(opts.preferredEducationStage));
  assignDefined(criteria, "preferredOccupationKeyword", optionalText(opts.preferredOccupationKeyword));
  assignDefined(criteria, "preferredHobbyText", optionalText(opts.preferredHobbyText));
  assignDefined(criteria, "preferredCharacterText", optionalText(opts.preferredCharacterText));
  assignDefined(criteria, "preferredAbilityText", optionalText(opts.preferredAbilityText));
  assignDefined(criteria, "intention", optionalText(opts.intention));
  assignDefined(criteria, "hobbyEmbeddingMinScore", parseOptionalDecimal(opts.hobbyEmbeddingMinScore, "hobby-embedding-min-score"));
  assignDefined(criteria, "characterEmbeddingMinScore", parseOptionalDecimal(opts.characterEmbeddingMinScore, "character-embedding-min-score"));
  assignDefined(criteria, "abilityEmbeddingMinScore", parseOptionalDecimal(opts.abilityEmbeddingMinScore, "ability-embedding-min-score"));
  assignDefined(criteria, "intentionEmbeddingMinScore", parseOptionalDecimal(opts.intentionEmbeddingMinScore, "intention-embedding-min-score"));
  assignDefined(criteria, "preferredContactChannel", optionalText(opts.preferredContactChannel));
  return criteria;
}

function buildTaskRequestBody(opts) {
  const taskName = optionalText(opts.taskName);
  if (!taskName) {
    throw new Error("Missing --task-name.");
  }
  return {
    taskName,
    criteria: buildTaskCriteriaFromOptions(opts)
  };
}

function buildRankingSetRequestBody(opts) {
  const body = {
    weightRecency: parseDecimal(opts.weightRecency, "weight-recency"),
    weightRating: parseDecimal(opts.weightRating, "weight-rating"),
    weightDailyExposureLow: parseDecimal(opts.weightDailyExposureLow, "weight-daily-exposure-low"),
    weightDailyRequestLow: parseDecimal(opts.weightDailyRequestLow, "weight-daily-request-low"),
    weightViolationLow: parseDecimal(opts.weightViolationLow, "weight-violation-low")
  };
  assignDefined(body, "weightHobbyEmbedding", parseOptionalDecimal(opts.weightHobbyEmbedding, "weight-hobby-embedding"));
  assignDefined(body, "weightCharacterEmbedding", parseOptionalDecimal(opts.weightCharacterEmbedding, "weight-character-embedding"));
  assignDefined(body, "weightAbilityEmbedding", parseOptionalDecimal(opts.weightAbilityEmbedding, "weight-ability-embedding"));
  assignDefined(body, "weightExactMatchScore", parseOptionalDecimal(opts.weightExactMatchScore, "weight-exact-match-score"));
  assignDefined(body, "weightExactMatchCount", parseOptionalDecimal(opts.weightExactMatchCount, "weight-exact-match-count"));
  assignDefined(body, "weightVectorSimilarity", parseOptionalDecimal(opts.weightVectorSimilarity, "weight-vector-similarity"));
  return body;
}

function normalizePhotoUrls(value) {
  const source = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];
  const result = [];
  for (const item of source) {
    const text = optionalText(item);
    if (!text) {
      continue;
    }
    if (!result.includes(text)) {
      result.push(text);
    }
  }
  return result;
}

function normalizeCheckResponse(response) {
  if (!response || typeof response !== "object") {
    return response;
  }
  const data = response.data;
  if (!data || typeof data !== "object") {
    return response;
  }
  const candidates = data.candidates;
  if (!Array.isArray(candidates)) {
    return response;
  }

  data.candidates = candidates.map((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return candidate;
    }
    const normalized = { ...candidate };
    const rawPhotoUrls =
      candidate.photoUrls ??
      candidate.photo_urls ??
      candidate.imageUrls ??
      candidate.profileImageUrls ??
      candidate.photos;
    normalized.photoUrls = normalizePhotoUrls(rawPhotoUrls);
    return normalized;
  });
  return response;
}

function clearAuthFields(config) {
  const next = { ...(config || {}) };
  delete next.token;
  delete next.tokenHead;
  delete next.memberId;
  delete next.username;
  return next;
}

function saveAuthFromResponse({ response, fallbackUsername }) {
  const data = (response && response.data) || {};
  const saveResult = mergeConfig({
    baseUrl: undefined,
    token: data.token || null,
    tokenHead: data.tokenHead || "Bearer ",
    memberId: data.memberId || null,
    username: data.username || fallbackUsername || null,
    updatedAt: new Date().toISOString()
  });
  return saveResult.configPath;
}

function saveTaskStateFromResponse({ response, operation, fallbackTaskId }) {
  const data = (response && response.data) || {};
  const resolvedTaskId =
    data.taskId !== undefined && data.taskId !== null ? data.taskId : fallbackTaskId;

  if (resolvedTaskId === undefined || resolvedTaskId === null) {
    return { configPath: null, taskState: null };
  }

  const savedAt = new Date().toISOString();
  const taskState = {
    taskId: resolvedTaskId,
    taskName: data.taskName || null,
    status: data.status || null,
    matchStatus: data.matchStatus || null,
    resultVersion: data.resultVersion ?? null,
    operation,
    updatedAt: savedAt
  };

  const saveResult = mergeConfig({
    lastTask: taskState,
    lastTaskId: taskState.taskId,
    lastTaskStatus: taskState.status,
    lastTaskMatchStatus: taskState.matchStatus,
    lastTaskOperation: taskState.operation,
    lastTaskUpdatedAt: taskState.updatedAt
  });

  return {
    configPath: saveResult.configPath,
    taskState
  };
}

function buildContext(opts, { authRequired = true } = {}) {
  const config = readConfig();
  const baseUrl = resolveBaseUrl();
  const authHeader = authRequired
    ? resolveAuthHeader({ token: opts.token, tokenHead: opts.tokenHead, config })
    : undefined;
  return { config, baseUrl, authHeader };
}

function withRequestOptions(command, { auth = true } = {}) {
  if (auth) {
    command.option("--token <token>", "JWT token, with or without token head");
    command.option("--token-head <head>", "Token head prefix, default 'Bearer '");
  }
  return command;
}

function withProfileUpdateOptions(command) {
  return command
    .option("--gender <value>", "Gender")
    .option("--birthday <yyyy-mm-dd>", "Birthday in yyyy-MM-dd")
    .option("--height-cm <value>", "Height in cm")
    .option("--weight-kg <value>", "Weight in kg")
    .option("--annual-income-cny <value>", "Annual income in CNY")
    .option("--character-text <text>", "Character text")
    .option("--hobby-text <text>", "Hobby text")
    .option("--ability-text <text>", "Ability text")
    .option("--major <text>", "Major")
    .option("--nationality <text>", "Nationality")
    .option("--country <text>", "Country")
    .option("--province <text>", "Province")
    .option("--city <text>", "City")
    .option("--address-detail <text>", "Address detail")
    .option("--current-latitude <value>", "Current latitude")
    .option("--current-longitude <value>", "Current longitude")
    .option("--current-location-text <text>", "Current location text")
    .option("--photo-url <url>", "Profile image URL, repeatable", collectRepeat, [])
    .option("--email <value>", "Email for match reminder notifications")
    .option("--phone <value>", "Phone")
    .option("--telegram <value>", "Telegram")
    .option("--wechat <value>", "Wechat")
    .option("--whatsapp <value>", "WhatsApp")
    .option("--signal-chat <value>", "Signal chat")
    .option("--line <value>", "Line")
    .option("--snapchat <value>", "Snapchat")
    .option("--instagram <value>", "Instagram")
    .option("--facebook <value>", "Facebook")
    .option("--other-contact <key=value>", "Other contact key=value, repeatable", collectRepeat, []);
}

function withTaskCriteriaOptions(command) {
  return command
    .option("--preferred-gender-filter <json>", "GraphQL filter JSON object, e.g. '{\"eq\":\"female\"}'")
    .option("--preferred-height-filter <json>", "GraphQL filter JSON object, e.g. '{\"gte\":165,\"lte\":180}'")
    .option("--preferred-income-filter <json>", "GraphQL filter JSON object, e.g. '{\"gte\":500000}'")
    .option("--preferred-city-filter <json>", "GraphQL filter JSON object, e.g. '{\"eq\":\"Shanghai\"}'")
    .option("--preferred-nationality-filter <json>", "GraphQL filter JSON object")
    .option("--preferred-education-filter <json>", "GraphQL filter JSON object")
    .option("--preferred-occupation-filter <json>", "GraphQL filter JSON object")
    .option("--preferred-education-stage <value>", "Education stage keyword")
    .option("--preferred-occupation-keyword <value>", "Occupation keyword")
    .option("--preferred-hobby-text <value>", "Preferred hobby text")
    .option("--preferred-character-text <value>", "Preferred character text")
    .option("--preferred-ability-text <value>", "Preferred ability text")
    .option("--intention <value>", "Match intention text")
    .option("--hobby-embedding-min-score <value>", "Min hobby embedding score (task create default 0.1)")
    .option("--character-embedding-min-score <value>", "Min character embedding score (task create default 0.1)")
    .option("--ability-embedding-min-score <value>", "Min ability embedding score (task create default 0.1)")
    .option("--intention-embedding-min-score <value>", "Min intention embedding score (task create default 0.1)")
    .option("--preferred-contact-channel <value>", "Preferred contact channel");
}

function formatError(error) {
  return {
    ok: false,
    error: {
      message: error.message,
      status: error.status || null,
      payload: error.payload || null
    }
  };
}

function run(action) {
  return async (...args) => {
    try {
      await action(...args);
    } catch (error) {
      printJson(formatError(error));
      process.exitCode = 1;
    }
  };
}

const program = new Command();
program
  .name("dating-cli")
  .description("CLI wrapper for dating APIs, designed for AI/agent workflows")
  .version(packageVersion);

withRequestOptions(
  program.command("register").description("Create account and get token"),
  { auth: false }
)
  .option("--username <username>", "Preferred username for register")
  .action(
    run(async (opts) => {
      const preferredUsername = opts.username ? String(opts.username).trim() : undefined;
      const { baseUrl } = buildContext(opts, { authRequired: false });
      const response = await request({
        method: "POST",
        path: "/register",
        baseUrl,
        body: preferredUsername ? { username: preferredUsername } : undefined
      });

      const savedTo = saveAuthFromResponse({
        response,
        fallbackUsername: preferredUsername
      });

      printJson({
        ok: true,
        savedTo,
        response
      });
    })
  );

withRequestOptions(
  program
    .command("login")
    .description("Login and get token")
    .option("--username <username>", "Login username")
    .option("--password <password>", "Login password"),
  { auth: false }
).action(
  run(async (opts) => {
    const username = optionalText(opts.username);
    const password = optionalText(opts.password);
    if (!username || !password) {
      throw new Error("Missing login payload. Provide --username and --password.");
    }
    const body = { username, password };

    const { baseUrl } = buildContext(opts, { authRequired: false });
    const response = await request({
      method: "POST",
      path: "/login",
      baseUrl,
      body
    });

    const savedTo = saveAuthFromResponse({
      response,
      fallbackUsername: body.username
    });

    printJson({
      ok: true,
      savedTo,
      response
    });
  })
);

withRequestOptions(
  program
    .command("logout")
    .description("Logout and clear local token"),
  { auth: true }
).action(
  run(async (opts) => {
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: "/logout",
      baseUrl,
      authHeader
    });

    const config = clearAuthFields(readConfig());
    const savedTo = writeConfig(config);

    printJson({
      ok: true,
      savedTo,
      config,
      response
    });
  })
);

const configCommand = program.command("config").description("Manage local dating-cli config");

configCommand
  .command("path")
  .description("Print config path")
  .action(
    run(async () => {
      printJson({ ok: true, configPath: resolveConfigPath() });
    })
  );

configCommand
  .command("show")
  .description("Show current config")
  .action(
    run(async () => {
      const config = { ...readConfig() };
      delete config.baseUrl;
      printJson({
        ok: true,
        configPath: resolveConfigPath(),
        config
      });
    })
  );

configCommand
  .command("set-base-url <baseUrl>")
  .description("Disabled: base URL is fixed and cannot be changed")
  .action(
    run(async () => {
      throw new Error(
        `Base URL is fixed to ${FIXED_BASE_URL} and cannot be changed.`
      );
    })
  );

configCommand
  .command("set-token <token>")
  .description("Set default token and optional token head")
  .option("--token-head <head>", "Token head prefix", "Bearer ")
  .action(
    run(async (token, opts) => {
      const result = mergeConfig({ token, tokenHead: opts.tokenHead });
      printJson({ ok: true, configPath: result.configPath, config: result.config });
    })
  );
configCommand
  .command("clear-token")
  .description("Remove token from local config")
  .action(
    run(async () => {
      const next = clearAuthFields(readConfig());
      const configPath = writeConfig(next);
      printJson({ ok: true, configPath, config: next });
    })
  );

const profileCommand = program.command("profile").description("Profile APIs");

withRequestOptions(
  withProfileUpdateOptions(
    profileCommand
      .command("update")
      .description("PUT /member-profile")
  ),
  { auth: true }
).action(
  run(async (opts) => {
    const body = buildProfileUpdateBody(opts);
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "PUT",
      path: "/member-profile",
      baseUrl,
      authHeader,
      body
    });
    printJson({ ok: true, response });
  })
);

withRequestOptions(
  program
    .command("upload <filePaths...>")
    .description("POST /minio/upload + PUT /member-profile(photoUrls)")
    .option("--field-name <name>", "Multipart field name, default file", "file"),
  { auth: true }
).action(
  run(async (filePaths, opts) => {
    const pathInputs = Array.isArray(filePaths) ? filePaths : [filePaths];
    const normalizedPaths = pathInputs
      .map((item) => optionalText(item))
      .filter((item) => item !== undefined);
    if (normalizedPaths.length === 0) {
      throw new Error("Missing file paths. Provide one or more file paths.");
    }

    const resolvedPaths = normalizedPaths.map((rawPath) => path.resolve(process.cwd(), rawPath));
    for (const resolvedPath of resolvedPaths) {
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File does not exist: ${resolvedPath}`);
      }
      const stat = fs.statSync(resolvedPath);
      if (!stat.isFile()) {
        throw new Error(`Path is not a file: ${resolvedPath}`);
      }
    }

    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const fieldName = optionalText(opts.fieldName) || "file";
    const uploaded = [];
    const photoUrls = [];
    for (const resolvedPath of resolvedPaths) {
      const fileBuffer = fs.readFileSync(resolvedPath);
      const fileName = path.basename(resolvedPath);
      const formData = new FormData();
      formData.append(fieldName, new Blob([fileBuffer]), fileName);

      const uploadResponse = await requestMultipart({
        method: "POST",
        path: "/minio/upload",
        baseUrl,
        authHeader,
        formData
      });
      const uploadData = uploadResponse && uploadResponse.data ? uploadResponse.data : {};
      const url = optionalText(uploadData.url);
      if (!url) {
        throw new Error(`Upload succeeded but response.data.url is missing: ${resolvedPath}`);
      }
      photoUrls.push(url);
      uploaded.push({
        filePath: resolvedPath,
        name: uploadData.name || fileName,
        url,
        response: uploadResponse
      });
    }

    const dedupedPhotoUrls = Array.from(new Set(photoUrls));
    const profileUpdateResponse = await request({
      method: "PUT",
      path: "/member-profile",
      baseUrl,
      authHeader,
      body: { photoUrls: dedupedPhotoUrls }
    });

    printJson({
      ok: true,
      photoUrls: dedupedPhotoUrls,
      uploaded,
      profileUpdateResponse
    });
  })
);

const taskCommand = program.command("task").description("Match task APIs");

withRequestOptions(
  withTaskCriteriaOptions(
    taskCommand
      .command("create")
      .description("POST /match-tasks")
      .option("--task-name <name>", "Task name")
  ),
  { auth: true }
).action(
  run(async (opts) => {
    const body = buildTaskRequestBody(opts);

    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: "/match-tasks",
      baseUrl,
      authHeader,
      body
    });
    const savedTask = saveTaskStateFromResponse({
      response,
      operation: "task.create"
    });
    printJson({
      ok: true,
      savedTo: savedTask.configPath,
      taskState: savedTask.taskState,
      response
    });
  })
);

withRequestOptions(
  taskCommand.command("get <taskId>").description("GET /match-tasks/{taskId}"),
  { auth: true }
).action(
  run(async (taskId, opts) => {
    const parsedTaskId = parseInteger(taskId, "taskId");
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "GET",
      path: `/match-tasks/${parsedTaskId}`,
      baseUrl,
      authHeader
    });
    const savedTask = saveTaskStateFromResponse({
      response,
      operation: "task.get",
      fallbackTaskId: parsedTaskId
    });
    printJson({
      ok: true,
      savedTo: savedTask.configPath,
      taskState: savedTask.taskState,
      response
    });
  })
);

withRequestOptions(
  withTaskCriteriaOptions(
    taskCommand
      .command("update <taskId>")
      .description("POST /match-tasks/{taskId}/update")
      .option("--task-name <name>", "Task name")
  ),
  { auth: true }
).action(
  run(async (taskId, opts) => {
    const parsedTaskId = parseInteger(taskId, "taskId");
    const body = buildTaskRequestBody(opts);
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: `/match-tasks/${parsedTaskId}/update`,
      baseUrl,
      authHeader,
      body
    });
    const savedTask = saveTaskStateFromResponse({
      response,
      operation: "task.update",
      fallbackTaskId: parsedTaskId
    });
    printJson({
      ok: true,
      savedTo: savedTask.configPath,
      taskState: savedTask.taskState,
      response
    });
  })
);

withRequestOptions(
  taskCommand.command("stop <taskId>").description("POST /match-tasks/{taskId}/stop"),
  { auth: true }
).action(
  run(async (taskId, opts) => {
    const parsedTaskId = parseInteger(taskId, "taskId");
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: `/match-tasks/${parsedTaskId}/stop`,
      baseUrl,
      authHeader
    });
    const savedTask = saveTaskStateFromResponse({
      response,
      operation: "task.stop",
      fallbackTaskId: parsedTaskId
    });
    printJson({
      ok: true,
      savedTo: savedTask.configPath,
      taskState: savedTask.taskState,
      response
    });
  })
);

withRequestOptions(
  program
    .command("check <taskId>")
    .description("GET /match-tasks/{taskId}/check")
    .option("--page <value>", "Page number, default 1"),
  { auth: true }
).action(
  run(async (taskId, opts) => {
    const parsedTaskId = parseInteger(taskId, "taskId");
    const page = parseOptionalInteger(opts.page, "page");
    if (page !== undefined && page < 1) {
      throw new Error("page must be >= 1");
    }
    const pageQuery = page === undefined ? "" : `?page=${encodeURIComponent(page)}`;
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "GET",
      path: `/match-tasks/${parsedTaskId}/check${pageQuery}`,
      baseUrl,
      authHeader
    });
    printJson({ ok: true, response: normalizeCheckResponse(response) });
  })
);

withRequestOptions(
  program.command("reveal-contact <matchId>").description("POST /match-results/{matchId}/reveal-contact"),
  { auth: true }
).action(
  run(async (matchId, opts) => {
    const parsedMatchId = parseInteger(matchId, "matchId");
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: `/match-results/${parsedMatchId}/reveal-contact`,
      baseUrl,
      authHeader
    });
    printJson({ ok: true, response });
  })
);

withRequestOptions(
  program
    .command("review <matchId>")
    .description("POST /match-results/{matchId}/reviews")
    .option("--rating <value>", "Rating 1..5")
    .option("--comment <text>", "Review comment"),
  { auth: true }
).action(
  run(async (matchId, opts) => {
    const parsedMatchId = parseInteger(matchId, "matchId");
    const rating = parseOptionalInteger(opts.rating, "rating");
    if (rating === undefined) {
      throw new Error("Missing rating. Provide --rating.");
    }
    if (rating < 1 || rating > 5) {
      throw new Error("rating must be in 1..5");
    }
    const body = { rating };
    assignDefined(body, "comment", optionalText(opts.comment));

    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: `/match-results/${parsedMatchId}/reviews`,
      baseUrl,
      authHeader,
      body
    });
    printJson({ ok: true, response });
  })
);

const adminCommand = program.command("admin").description("Admin APIs");

withRequestOptions(
  adminCommand
    .command("violation-review <caseId>")
    .description("POST /admin/match-violations/{caseId}/review")
    .option("--status <status>", "confirmed or rejected")
    .option("--review-note <note>", "Review note"),
  { auth: true }
).action(
  run(async (caseId, opts) => {
    const parsedCaseId = parseInteger(caseId, "caseId");
    const status = optionalText(opts.status);
    if (!status) {
      throw new Error("Missing status. Provide --status.");
    }
    if (status !== "confirmed" && status !== "rejected") {
      throw new Error("status must be confirmed or rejected");
    }
    const body = { status };
    assignDefined(body, "reviewNote", optionalText(opts.reviewNote));

    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "POST",
      path: `/admin/match-violations/${parsedCaseId}/review`,
      baseUrl,
      authHeader,
      body
    });
    printJson({ ok: true, response });
  })
);

withRequestOptions(
  adminCommand.command("ranking-get").description("GET /admin/match-ranking-config"),
  { auth: true }
).action(
  run(async (opts) => {
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "GET",
      path: "/admin/match-ranking-config",
      baseUrl,
      authHeader
    });
    printJson({ ok: true, response });
  })
);

withRequestOptions(
  adminCommand
    .command("ranking-set")
    .description("PUT /admin/match-ranking-config")
    .option("--weight-recency <value>", "Required")
    .option("--weight-rating <value>", "Required")
    .option("--weight-daily-exposure-low <value>", "Required")
    .option("--weight-daily-request-low <value>", "Required")
    .option("--weight-violation-low <value>", "Required")
    .option("--weight-hobby-embedding <value>", "Optional")
    .option("--weight-character-embedding <value>", "Optional")
    .option("--weight-ability-embedding <value>", "Optional")
    .option("--weight-exact-match-score <value>", "Optional")
    .option("--weight-exact-match-count <value>", "Optional")
    .option("--weight-vector-similarity <value>", "Optional"),
  { auth: true }
).action(
  run(async (opts) => {
    const body = buildRankingSetRequestBody(opts);
    const { baseUrl, authHeader } = buildContext(opts, { authRequired: true });
    const response = await request({
      method: "PUT",
      path: "/admin/match-ranking-config",
      baseUrl,
      authHeader,
      body
    });
    printJson({ ok: true, response });
  })
);

program.parseAsync(process.argv);
