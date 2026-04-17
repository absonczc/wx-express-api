/**
 * 为 PostgreSQL 连接 URI 合并 libpq 会话参数 `options=-c TimeZone=…`，
 * 使 `CURRENT_TIMESTAMP`、Prisma `@default(now())` / `@updatedAt` 等与库交互的时间
 * 按指定时区（默认中国）解释、写入 `TIMESTAMP WITHOUT TIME ZONE` 列时与业务预期一致。
 *
 * @see https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-OPTIONS
 */
export function withPostgresSessionTimezone(
  urlString: string,
  timeZone: string = "Asia/Shanghai"
): string {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return urlString;
  }

  const optionsEncoded = url.searchParams.get("options");
  if (optionsEncoded) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(optionsEncoded);
    } catch {
      decoded = optionsEncoded;
    }
    if (sessionTimeZoneAlreadySet(decoded)) {
      return urlString;
    }
    url.searchParams.set("options", `${decoded} -c TimeZone=${timeZone}`);
    return url.toString();
  }

  url.searchParams.set("options", `-c TimeZone=${timeZone}`);
  return url.toString();
}

function sessionTimeZoneAlreadySet(optionsDecoded: string): boolean {
  return /\bTimeZone\s*=/i.test(optionsDecoded) || /\btimezone\s*=/i.test(optionsDecoded);
}
