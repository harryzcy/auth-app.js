import { Lru } from "toad-cache";

/* v8 ignore next */
import type {
  CacheableInstallationAuthOptions,
  Cache,
  CacheData,
  Permissions,
  InstallationAccessTokenData,
  REPOSITORY_SELECTION,
} from "./types.js";

export function getCache() {
  return new Lru<string>(
    // cache max. 15000 tokens, that will use less than 10mb memory
    15000,
    // Cache for 1 minute less than GitHub expiry
    1000 * 60 * 59,
  );
}

export async function get(
  cache: Cache,
  options: CacheableInstallationAuthOptions,
): Promise<InstallationAccessTokenData | void> {
  const cacheKey = optionsToCacheKey(options);
  const result = await cache.get(cacheKey);

  if (!result) {
    return;
  }

  const [
    token,
    createdAt,
    expiresAt,
    repositorySelection,
    permissionsString,
    singleFileName,
  ] = result.split("|");

  const permissions =
    options.permissions ||
    permissionsString
      .split(/,/)
      .reduce((permissions: Permissions, string: string) => {
        if (/!$/.test(string)) {
          permissions[string.slice(0, -1)] = "write";
        } else {
          permissions[string] = "read";
        }

        return permissions;
      }, {} as Permissions);

  return {
    token,
    createdAt,
    expiresAt,
    permissions,
    repositoryIds: options.repositoryIds,
    repositoryNames: options.repositoryNames,
    singleFileName,
    repositorySelection: repositorySelection as REPOSITORY_SELECTION,
  };
}
export async function set(
  cache: Cache,
  options: CacheableInstallationAuthOptions,
  data: CacheData,
): Promise<void> {
  const key = optionsToCacheKey(options);

  const permissionsString = options.permissions
    ? ""
    : Object.keys(data.permissions)
        .map(
          (name) => `${name}${data.permissions[name] === "write" ? "!" : ""}`,
        )
        .join(",");

  const value = [
    data.token,
    data.createdAt,
    data.expiresAt,
    data.repositorySelection,
    permissionsString,
    data.singleFileName,
  ].join("|");

  await cache.set(key, value);
}

// TODO: consider baseUrl and appId too, so that we don't incorrectly cache tokens across them
export function optionsToCacheKey({
  installationId,
  permissions = {},
  repositoryIds = [],
  repositoryNames = [],
}: CacheableInstallationAuthOptions) {
  const permissionsString = Object.keys(permissions)
    .sort()
    .map((name) => (permissions[name] === "read" ? name : `${name}!`))
    .join(",");

  const repositoryIdsString = repositoryIds.sort().join(",");
  const repositoryNamesString = repositoryNames.join(",");

  return [
    installationId,
    repositoryIdsString,
    repositoryNamesString,
    permissionsString,
  ]
    .filter(Boolean)
    .join("|");
}
