import { logger } from "../../lib/logger.js";

const DONGQIUDI_API_URL = "https://api.dongqiudi.com/data/tab/new/soccer";

interface DongqiudiParams {
  start: string;
  version?: number;
  init?: number;
  wfrom?: number;
  from?: string;
}

interface DongqiudiResponse {
  list?: unknown[];
  prevDate?: string;
  nextDate?: string;
  finishFlag?: string;
  [key: string]: unknown;
}

export async function fetchFootballList(params: DongqiudiParams): Promise<DongqiudiResponse> {
  const queryParams = new URLSearchParams({
    start: params.start,
    version: String(params.version ?? 576),
    init: String(params.init ?? 0),
    wfrom: String(params.wfrom ?? 2),
    from: params.from ?? "msite_com",
  });

  const url = `${DONGQIUDI_API_URL}?${queryParams.toString()}`;

  logger.info(`Fetching football list from dongqiudi: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Connection": "keep-alive",
      "Pragma": "no-cache",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1 wechatdevtools/1.06.2504020 MicroMessenger/8.0.5 Language/zh_CN webview/ sessionid/30",
      "content-type": "application/json",
      "Accept": "application/json, text/plain, */*",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://servicewechat.com/wxa2091918421e9f97/devtools/page-frame.html",
      "origin": "https://m.dongqiudi.com",
    },
  });

  if (!response.ok && response.status !== 304) {
    logger.error(`Dongqiudi API error: ${response.status} ${response.statusText}`);
    throw new Error(`Dongqiudi API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 304) {
    logger.info(`Dongqiudi API returned 304 Not Modified`);
    return { list: [], prevDate: undefined, nextDate: undefined, finishFlag: undefined };
  }

  const data: DongqiudiResponse = await response.json();

  logger.info(`Successfully fetched football list`);
  return data;
}

interface MatchItem {
  id?: number | string;
  left_name?: string;
  right_name?: string;
  league_name?: string;
  match_time?: string | number;
  status?: number | string;
  [key: string]: unknown;
}

function isTodayOrTomorrow(timestamp: number): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matchDate = new Date(timestamp * 1000);

  return matchDate >= today && matchDate < tomorrow && matchDate.getHours() >= 0 && matchDate.getHours() < 24;
}

function formatMatchItem(item: MatchItem, index: number): string {
  const n = item.id ?? index + 1;
  const leftName = item.left_name ?? "未知球队";
  const rightName = item.right_name ?? "未知球队";
  const leagueName = item.league_name ?? "未知联赛";
  const matchTime = item.match_time
    ? new Date(Number(item.match_time) * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : "未知时间";

  return `比赛${n}（match_id=${n}）：\n${leftName} vs ${rightName}｜${leagueName}｜${matchTime}`;
}

export function buildTodayTomorrowPrompt(footballData: unknown): string {
  if (!footballData || typeof footballData !== "object") {
    return "";
  }

  const dataObj = footballData as { list?: unknown[]; matches?: unknown[]; data?: unknown[] };

  let matchList: unknown[] = [];

  if (Array.isArray(dataObj.list)) {
    matchList = dataObj.list;
  } else if (Array.isArray(dataObj.matches)) {
    matchList = dataObj.matches;
  } else if (Array.isArray(dataObj.data)) {
    matchList = dataObj.data;
  } else if (Array.isArray(dataObj)) {
    matchList = dataObj as unknown[];
  }

  const todayTomorrowMatches = matchList.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const matchItem = item as MatchItem;
    if (typeof matchItem.match_time === "number") {
      return isTodayOrTomorrow(matchItem.match_time);
    }
    return false;
  });

  if (todayTomorrowMatches.length === 0) {
    return "";
  }

  return todayTomorrowMatches
    .map((item, index) => formatMatchItem(item as MatchItem, index))
    .join("\n\n");
}

export interface TransformedMatch {
  matchId: string;
  teamA: {
    id: string;
    name: string;
    logo: string;
  };
  teamB: {
    id: string;
    name: string;
    logo: string;
  };
  league: {
    id: string;
    name: string;
    color: string;
  };
  matchTime: string;
  status: string;
  score?: {
    fullTime: string;
    halfTime: string;
  };
  events?: Array<{
    player: string;
    time: string;
    type: "G" | "Y" | "R" | string;
  }>;
}

export interface TransformedFootballResponse {
  matches: TransformedMatch[];
  total: number;
}

const DONGQIUDI_SITUATION_API = "https://api.dongqiudi.com/mobile/match/situation";
const DONGQIUDI_LINEUP_API = "https://api.dongqiudi.com/mobile/match/lineup";
const DONGQIUDI_ANALYSIS_API = "https://sport-data.dongqiudi.com/soccer/biz/dqd/match/pre_analyze_data_contrast";

const COMMON_HEADERS = {
  "Connection": "keep-alive",
  "Pragma": "no-cache",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "content-type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Site": "same-site",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Referer": "https://m.dongqiudi.com/",
  "origin": "https://m.dongqiudi.com",
};

export interface MatchSituationData {
  show_time_day: string;
  show_time_min: string;
  match: {
    id: string;
    competition: {
      id: string;
      name: string;
      short_name: string;
      logo: string;
      color: string;
    };
    team_A: {
      id: string;
      name: string;
      short_name: string;
      logo: string;
      rank: { rank: number };
      score: string;
    };
    team_B: {
      id: string;
      name: string;
      short_name: string;
      logo: string;
      rank: { rank: number };
      score: string;
    };
    start_play: string;
    status: string;
    period: string;
    minute: string;
    winner: string;
  };
  info: {
    status: string;
    events: Record<string, {
      minute: string;
      teamAEvents: Array<{
        event_pic: string;
        person: string;
        person_id: string;
      }>;
      teamBEvents: Array<{
        event_pic: string;
        person: string;
        person_id: string;
      }>;
    }>;
    statistics: {
      team_A: { name: string; logo: string };
      team_B: { name: string; logo: string };
      list: Array<{
        type: string;
        team_A: { value: number; per: number };
        team_B: { value: number; per: number };
      }>;
    };
  };
}

export interface MatchLineupData {
  match: {
    id: string;
    team_A: { id: string; name: string; logo: string; score: string };
    team_B: { id: string; name: string; logo: string; score: string };
    start_play: string;
    status: string;
  };
  info: {
    base: {
      attendance_rate: string;
      weather: string;
      temperature: string;
      field: string;
      referee: string;
    };
    lineup: Array<{
      team_A: {
        person_id: number;
        person: string;
        captain: number;
        shirtnumber: string;
        position_x: string;
        position_y: string;
        formation_place: number;
        events: Array<{ type: string; minute: string; event_pic: string }>;
        person_logo: string;
        position: string;
      };
      team_B: {
        person_id: number;
        person: string;
        captain: number;
        shirtnumber: string;
        position_x: string;
        position_y: string;
        formation_place: number;
        events: Array<{ type: string; minute: string; event_pic: string }>;
        person_logo: string;
        position: string;
      };
    }>;
    sub: Array<{
      team_A: {
        person_id: number;
        person: string;
        captain: number;
        shirtnumber: string;
        position_x: string | null;
        position_y: string | null;
        formation_place: number;
        events: Array<{ type: string; minute: string; event_pic: string }>;
        person_logo: string;
        position: string;
      };
      team_B: {
        person_id: number;
        person: string;
        captain: number;
        shirtnumber: string;
        position_x: string | null;
        position_y: string | null;
        formation_place: number;
        events: Array<{ type: string; minute: string; event_pic: string }>;
        person_logo: string;
        position: string;
      };
    }>;
    per_posithion: Record<string, string>;
  };
}

export interface MatchAnalysisData {
  data: {
    attack_defend: {
      title: string;
      winner: string;
      data: Array<{
        title: string;
        team_A: { match_info: string };
        team_B: { match_info: string };
      }>;
    };
    comprehensive: {
      title: string;
      team_A_score: string;
      team_B_score: string;
      winner: string;
      data: Array<{
        title: string;
        team_A: { match_info: string; score?: string };
        team_B: { match_info: string; score?: string };
      }>;
    };
    control: {
      title: string;
      winner: string;
      data: Array<{
        title: string;
        team_A: { match_info: string };
        team_B: { match_info: string };
      }>;
    };
    corner: {
      title: string;
      winner: string;
      data: Array<{
        title: string;
        team_A: { match_info: string; score: string };
        team_B: { match_info: string; score: string };
      }>;
    };
    half_all: {
      title: string;
      winner: string;
      data: Array<{
        title: string;
        half_winner?: string;
        s_half_winner?: string;
        team_A: { half: string; s_half: string };
        team_B: { half: string; s_half: string };
      }>;
    };
    statistics: {
      title: string;
      winner: string;
      data: Array<{
        title: string;
        team_A: { match_info: string };
        team_B: { match_info: string };
      }>;
    };
  };
  errno: number;
  message: string;
}

export interface TransformedMatchDetail {
  matchInfo: {
    matchId: string;
    league: {
      id: string;
      name: string;
      shortName: string;
      logo: string;
      color: string;
    };
    teamA: {
      id: string;
      name: string;
      shortName: string;
      logo: string;
      rank: number;
      score: string;
    };
    teamB: {
      id: string;
      name: string;
      shortName: string;
      logo: string;
      rank: number;
      score: string;
    };
    startPlay: string;
    status: string;
    period: string;
    minute: string;
    winner: string;
    showTimeDay: string;
    showTimeMin: string;
  };
  events: Array<{
    minute: string;
    teamAEvents: Array<{
      player: string;
      playerId: string;
      eventPic: string;
    }>;
    teamBEvents: Array<{
      player: string;
      playerId: string;
      eventPic: string;
    }>;
  }>;
  statistics: {
    teamA: { name: string; logo: string };
    teamB: { name: string; logo: string };
    items: Array<{
      type: string;
      teamA: { value: number; per: number };
      teamB: { value: number; per: number };
    }>;
  };
  lineup: {
    teamA: {
      players: Array<{
        personId: number;
        person: string;
        captain: number;
        shirtNumber: string;
        positionX: string;
        positionY: string;
        formationPlace: number;
        events: Array<{ type: string; minute: string; eventPic: string }>;
        personLogo: string;
        position: string;
      }>;
      substitutes: Array<{
        personId: number;
        person: string;
        captain: number;
        shirtNumber: string;
        events: Array<{ type: string; minute: string; eventPic: string }>;
        personLogo: string;
        position: string;
      }>;
    };
    teamB: {
      players: Array<{
        personId: number;
        person: string;
        captain: number;
        shirtNumber: string;
        positionX: string;
        positionY: string;
        formationPlace: number;
        events: Array<{ type: string; minute: string; eventPic: string }>;
        personLogo: string;
        position: string;
      }>;
      substitutes: Array<{
        personId: number;
        person: string;
        captain: number;
        shirtNumber: string;
        events: Array<{ type: string; minute: string; eventPic: string }>;
        personLogo: string;
        position: string;
      }>;
    };
    positions: Record<string, string>;
  };
  analysis: {
    attackDefend: {
      title: string;
      data: Array<{
        title: string;
        teamA: { matchInfo: string };
        teamB: { matchInfo: string };
      }>;
    };
    comprehensive: {
      title: string;
      teamAScore: string;
      teamBScore: string;
      data: Array<{
        title: string;
        teamA: { matchInfo: string; score?: string };
        teamB: { matchInfo: string; score?: string };
      }>;
    };
    control: {
      title: string;
      data: Array<{
        title: string;
        teamA: { matchInfo: string };
        teamB: { matchInfo: string };
      }>;
    };
    corner: {
      title: string;
      data: Array<{
        title: string;
        teamA: { matchInfo: string; score: string };
        teamB: { matchInfo: string; score: string };
      }>;
    };
    halfAll: {
      title: string;
      data: Array<{
        title: string;
        halfWinner?: string;
        sHalfWinner?: string;
        teamA: { half: string; sHalf: string };
        teamB: { half: string; sHalf: string };
      }>;
    };
    statistics: {
      title: string;
      data: Array<{
        title: string;
        teamA: { matchInfo: string };
        teamB: { matchInfo: string };
      }>;
    };
  };
}

export async function fetchMatchSituation(matchId: string): Promise<MatchSituationData> {
  const url = `${DONGQIUDI_SITUATION_API}/${matchId}`;

  logger.info(`Fetching match situation from dongqiudi: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    logger.error(`Dongqiudi situation API error: ${response.status} ${response.statusText}`);
    throw new Error(`Dongqiudi situation API error: ${response.status} ${response.statusText}`);
  }

  const data: MatchSituationData = await response.json();

  logger.info(`Successfully fetched match situation for matchId: ${matchId}`);
  return data;
}

export async function fetchMatchLineup(matchId: string): Promise<MatchLineupData> {
  const url = `${DONGQIUDI_LINEUP_API}/${matchId}`;

  logger.info(`Fetching match lineup from dongqiudi: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    logger.error(`Dongqiudi lineup API error: ${response.status} ${response.statusText}`);
    throw new Error(`Dongqiudi lineup API error: ${response.status} ${response.statusText}`);
  }

  const data: MatchLineupData = await response.json();

  logger.info(`Successfully fetched match lineup for matchId: ${matchId}`);
  return data;
}

export async function fetchMatchAnalysis(matchId: string): Promise<MatchAnalysisData> {
  const url = `${DONGQIUDI_ANALYSIS_API}/${matchId}?app=dqd`;

  logger.info(`Fetching match analysis from dongqiudi: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: COMMON_HEADERS,
  });

  if (!response.ok) {
    logger.error(`Dongqiudi analysis API error: ${response.status} ${response.statusText}`);
    throw new Error(`Dongqiudi analysis API error: ${response.status} ${response.statusText}`);
  }

  const data: MatchAnalysisData = await response.json();

  logger.info(`Successfully fetched match analysis for matchId: ${matchId}`);
  return data;
}

export function transformMatchDetail(
  situation: MatchSituationData,
  lineup: MatchLineupData,
  analysis: MatchAnalysisData
): TransformedMatchDetail {
  const match = situation.match;

  // 比赛阶段中文映射
  const periodMap: Record<string, string> = {
    "FT": "全场",
    "HT": "半场",
    "1H": "上半场",
    "2H": "下半场",
    "ET": "加时赛",
    "P": "点球大战",
    "BT": "开球前"
  };

  // 获取中文比赛阶段
  const periodZh = periodMap[match.period] || match.period;

  return {
    matchInfo: {
      matchId: match.id,
      league: {
        id: match.competition.id,
        name: match.competition.name,
        shortName: match.competition.short_name,
        logo: match.competition.logo,
        color: match.competition.color,
      },
      teamA: {
        id: match.team_A.id,
        name: match.team_A.name,
        shortName: match.team_A.short_name,
        logo: match.team_A.logo,
        rank: match.team_A.rank?.rank ?? 0,
        score: match.team_A.score,
      },
      teamB: {
        id: match.team_B.id,
        name: match.team_B.name,
        shortName: match.team_B.short_name,
        logo: match.team_B.logo,
        rank: match.team_B.rank?.rank ?? 0,
        score: match.team_B.score,
      },
      startPlay: match.start_play,
      status: match.status,
      period: periodZh,
      minute: match.minute,
      winner: match.winner,
      showTimeDay: situation.show_time_day,
      showTimeMin: situation.show_time_min,
    },
    events: Object.values(situation.info.events ?? {}).map((event) => ({
      minute: event.minute,
      teamAEvents: (event.teamAEvents ?? []).map((e) => ({
        player: e.person,
        playerId: e.person_id,
        eventPic: e.event_pic,
      })),
      teamBEvents: (event.teamBEvents ?? []).map((e) => ({
        player: e.person,
        playerId: e.person_id,
        eventPic: e.event_pic,
      })),
    })),
    statistics: {
      teamA: {
        name: situation.info.statistics?.team_A?.name ?? "",
        logo: situation.info.statistics?.team_A?.logo ?? "",
      },
      teamB: {
        name: situation.info.statistics?.team_B?.name ?? "",
        logo: situation.info.statistics?.team_B?.logo ?? "",
      },
      items: (situation.info.statistics?.list ?? []).map((item) => ({
        type: item.type,
        teamA: { value: item.team_A?.value ?? 0, per: item.team_A?.per ?? 0 },
        teamB: { value: item.team_B?.value ?? 0, per: item.team_B?.per ?? 0 },
      })),
    },
    lineup: {
      teamA: {
        players: (lineup.info.lineup ?? []).map((p) => ({
          personId: p.team_A.person_id,
          person: p.team_A.person,
          captain: p.team_A.captain,
          shirtNumber: p.team_A.shirtnumber,
          positionX: p.team_A.position_x,
          positionY: p.team_A.position_y,
          formationPlace: p.team_A.formation_place,
          events: (p.team_A.events ?? []).map((e) => ({
            type: e.type,
            minute: e.minute,
            eventPic: e.event_pic,
          })),
          personLogo: p.team_A.person_logo,
          position: p.team_A.position,
        })),
        substitutes: (lineup.info.sub ?? []).map((s) => ({
          personId: s.team_A.person_id,
          person: s.team_A.person,
          captain: s.team_A.captain,
          shirtNumber: s.team_A.shirtnumber,
          events: (s.team_A.events ?? []).map((e) => ({
            type: e.type,
            minute: e.minute,
            eventPic: e.event_pic,
          })),
          personLogo: s.team_A.person_logo,
          position: s.team_A.position,
        })),
      },
      teamB: {
        players: (lineup.info.lineup ?? []).map((p) => ({
          personId: p.team_B.person_id,
          person: p.team_B.person,
          captain: p.team_B.captain,
          shirtNumber: p.team_B.shirtnumber,
          positionX: p.team_B.position_x,
          positionY: p.team_B.position_y,
          formationPlace: p.team_B.formation_place,
          events: (p.team_B.events ?? []).map((e) => ({
            type: e.type,
            minute: e.minute,
            eventPic: e.event_pic,
          })),
          personLogo: p.team_B.person_logo,
          position: p.team_B.position,
        })),
        substitutes: (lineup.info.sub ?? []).map((s) => ({
          personId: s.team_B.person_id,
          person: s.team_B.person,
          captain: s.team_B.captain,
          shirtNumber: s.team_B.shirtnumber,
          events: (s.team_B.events ?? []).map((e) => ({
            type: e.type,
            minute: e.minute,
            eventPic: e.event_pic,
          })),
          personLogo: s.team_B.person_logo,
          position: s.team_B.position,
        })),
      },
      positions: lineup.info.per_posithion ?? {},
    },
    analysis: {
      attackDefend: {
        title: analysis.data.attack_defend?.title ?? "",
        data: (analysis.data.attack_defend?.data ?? []).map((d) => ({
          title: d.title,
          teamA: { matchInfo: d.team_A?.match_info ?? "" },
          teamB: { matchInfo: d.team_B?.match_info ?? "" },
        })),
      },
      comprehensive: {
        title: analysis.data.comprehensive?.title ?? "",
        teamAScore: analysis.data.comprehensive?.team_A_score ?? "",
        teamBScore: analysis.data.comprehensive?.team_B_score ?? "",
        data: (analysis.data.comprehensive?.data ?? []).map((d) => ({
          title: d.title,
          teamA: { matchInfo: d.team_A?.match_info ?? "", score: d.team_A?.score },
          teamB: { matchInfo: d.team_B?.match_info ?? "", score: d.team_B?.score },
        })),
      },
      control: {
        title: analysis.data.control?.title ?? "",
        data: (analysis.data.control?.data ?? []).map((d) => ({
          title: d.title,
          teamA: { matchInfo: d.team_A?.match_info ?? "" },
          teamB: { matchInfo: d.team_B?.match_info ?? "" },
        })),
      },
      corner: {
        title: analysis.data.corner?.title ?? "",
        data: (analysis.data.corner?.data ?? []).map((d) => ({
          title: d.title,
          teamA: { matchInfo: d.team_A?.match_info ?? "", score: d.team_A?.score ?? "" },
          teamB: { matchInfo: d.team_B?.match_info ?? "", score: d.team_B?.score ?? "" },
        })),
      },
      halfAll: {
        title: analysis.data.half_all?.title ?? "",
        data: (analysis.data.half_all?.data ?? []).map((d) => ({
          title: d.title,
          halfWinner: d.half_winner,
          sHalfWinner: d.s_half_winner,
          teamA: { half: d.team_A?.half ?? "", sHalf: d.team_A?.s_half ?? "" },
          teamB: { half: d.team_B?.half ?? "", sHalf: d.team_B?.s_half ?? "" },
        })),
      },
      statistics: {
        title: analysis.data.statistics?.title ?? "",
        data: (analysis.data.statistics?.data ?? []).map((d) => ({
          title: d.title,
          teamA: { matchInfo: d.team_A?.match_info ?? "" },
          teamB: { matchInfo: d.team_B?.match_info ?? "" },
        })),
      },
    },
  };
}

interface DongqiudiMatchItem {
  match_id?: string | number;
  team_A_id?: string | number;
  team_A_name?: string;
  team_A_logo?: string;
  team_B_id?: string | number;
  team_B_name?: string;
  team_B_logo?: string;
  competition_id?: string | number;
  competition_name?: string;
  competition_color?: string;
  start_play?: string;
  sort_timestamp?: number;
  status?: string;
  fs_A?: string;
  fs_B?: string;
  hts_A?: string;
  hts_B?: string;
  team_A_events?: Array<{ title?: string; code?: string }>;
  team_B_events?: Array<{ title?: string; code?: string }>;
  minute_period?: string;
  minute?: string | number;
  [key: string]: unknown;
}

function convertToChinaTime(dateStr: string): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function parseUtcToChinaTime(dateStr: string): string {
  if (!dateStr) return "";

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return dateStr;

  const [, year, month, day, hour, minute, second] = match;
  const utcDate = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));

  return utcDate.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function transformMatchItem(item: DongqiudiMatchItem): TransformedMatch {
  let matchTime = "";

  if (item.start_play) {
    matchTime = parseUtcToChinaTime(item.start_play);
  } else if (item.sort_timestamp) {
    matchTime = convertToChinaTime(new Date(Number(item.sort_timestamp) * 1000).toISOString());
  }

  const score = item.fs_A && item.fs_B
    ? {
        fullTime: `${item.fs_A}-${item.fs_B}`,
        halfTime: item.hts_A && item.hts_B ? `${item.hts_A}-${item.hts_B}` : "",
      }
    : undefined;

  const events: TransformedMatch["events"] = [];

  if (Array.isArray(item.team_A_events)) {
    for (const event of item.team_A_events) {
      if (event.title) {
        const timeMatch = event.title.match(/(\d+)'/);
        events.push({
          player: event.title.replace(/\s*\d+'.*$/, ""),
          time: timeMatch ? `${timeMatch[1]}'` : "",
          type: event.code || "G",
        });
      }
    }
  }

  if (Array.isArray(item.team_B_events)) {
    for (const event of item.team_B_events) {
      if (event.title) {
        const timeMatch = event.title.match(/(\d+)'/);
        events.push({
          player: event.title.replace(/\s*\d+'.*$/, ""),
          time: timeMatch ? `${timeMatch[1]}'` : "",
          type: event.code || "G",
        });
      }
    }
  }

  return {
    matchId: String(item.match_id ?? ""),
    teamA: {
      id: String(item.team_A_id ?? ""),
      name: item.team_A_name ?? "",
      logo: item.team_A_logo ?? "",
    },
    teamB: {
      id: String(item.team_B_id ?? ""),
      name: item.team_B_name ?? "",
      logo: item.team_B_logo ?? "",
    },
    league: {
      id: String(item.competition_id ?? ""),
      name: item.competition_name ?? "",
      color: item.competition_color ?? "",
    },
    matchTime,
    status: item.status ?? "",
    score,
    events: events.length > 0 ? events : undefined,
  };
}

export function transformFootballData(footballData: unknown): TransformedFootballResponse {
  if (!footballData || typeof footballData !== "object") {
    return { matches: [], total: 0 };
  }

  const dataObj = footballData as { list?: unknown[]; matches?: unknown[]; data?: unknown[] };

  let matchList: unknown[] = [];

  if (Array.isArray(dataObj.list)) {
    matchList = dataObj.list;
  } else if (Array.isArray(dataObj.matches)) {
    matchList = dataObj.matches;
  } else if (Array.isArray(dataObj.data)) {
    matchList = dataObj.data;
  } else if (Array.isArray(dataObj)) {
    matchList = dataObj as unknown[];
  }

  const transformedMatches = matchList
    .filter((item) => item && typeof item === "object")
    .map((item) => transformMatchItem(item as DongqiudiMatchItem));

  return {
    matches: transformedMatches,
    total: transformedMatches.length,
  };
}