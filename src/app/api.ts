import { checkValidity } from "../ui/console";

const SERVER = 'looking-glass.nc.menhera.org#443';
const resolver = new doh.DohResolver('https://looking-glass.nc.menhera.org/dns-query');

export interface DnsQuestion {
  class: string;
  type: string;
  name: string;
}

export interface DnsAnswer {
  class: string;
  type: string;
  name: string;
  ttl: number;
  data: string;
}

export interface DnsResponse {
  rcode: string;
  questions: DnsQuestion[];
  answers: DnsAnswer[];
  authorities: DnsAnswer[];
  id: number;
  time?: number;
  queryTime?: number;
}

export const buildReverseName = (ip: string) => {
  const validity = checkValidity(ip);
  if (validity.ipv4Address) {
    return buildReverseName4(ip);
  }
  if (validity.ipv6Address) {
    return buildReverseName6(ip);
  }
  throw new Error("Invalid IP address");
};

export const buildReverseName4 = (ip: string) => {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    throw new Error("Invalid IPv4 address");
  }
  const reversedParts = parts.reverse();
  const reversedIp = reversedParts.join(".");
  return `${reversedIp}.in-addr.arpa`;
};

export const buildReverseName6 = (ip: string) => {
  if (ip.includes("::")) {
    const parts = ip.split("::");
    const left = parts[0]!.split(":");
    const right = parts[1]!.split(":");
    const missing = 8 - (left.length + right.length);
    const expanded = left.concat(Array(missing).fill("0"), right);
    ip = expanded.join(":");
  }

  const parts = ip.split(":").map((part) => part.padStart(4, "0").split("")).flat();
  if (parts.length !== 32) {
    throw new Error("Invalid IPv6 address");
  }
  const reversedParts = parts.reverse();
  const reversedIp = reversedParts.join(".");
  return `${reversedIp}.ip6.arpa`;
};

export const resolveAuto = async (name: string) => {
  const validity = checkValidity(name);
  if (validity.hostname) {
    return { A: await resolve(name, "A"), AAAA: await resolve(name, "AAAA") };
  }
  if (validity.ipv4Address || validity.ipv6Address) {
    const reverseName = validity.ipv4Address ? buildReverseName4(name) : buildReverseName6(name);
    return { PTR: await resolve(reverseName, "PTR") };
  }

  throw new Error("Invalid hostname or IP address");
};

export interface DnsNameServerInfo {
  name: string;
  ipv4: string[];
  ipv6: string[];
}

export interface DnsZoneInfo {
  zoneName: string;
  primaryNameServer: string; // from SOA
  adminContact: string; // from SOA
  serial: number; // from SOA
  refresh: number; // from SOA
  retry: number; // from SOA
  expire: number; // from SOA
  minimum: number; // from SOA
  nameServers: DnsNameServerInfo[]; // from NS records
}

export const resolveZoneInfo = async (domainName: string) => {
  const validity = checkValidity(domainName);
  if (!validity.hostname) {
    throw new Error("Invalid hostname");
  }
  const soaResult = await resolve(domainName, "SOA").catch((e) => ({} as DnsResponse));
  const soa = soaResult?.answers?.filter((a) => a.type == 'SOA')[0] ?? soaResult?.authorities?.filter((a) => a.type == 'SOA')[0] ?? null;
  const soaParts = soa?.data.split(" ") ?? [];
  const zoneName = soa?.name ?? '';
  const primaryNameServer = soaParts[0] ?? '';
  const adminContact = soaParts[1] ?? '';
  const serial = parseInt(soaParts[2] ?? '0', 10);
  const refresh = parseInt(soaParts[3] ?? '0', 10);
  const retry = parseInt(soaParts[4] ?? '0', 10);
  const expire = parseInt(soaParts[5] ?? '0', 10);
  const minimum = parseInt(soaParts[6] ?? '0', 10);
  const nsResult = zoneName == '' ? {} as DnsResponse : await resolve(zoneName, "NS").catch((e) => ({} as DnsResponse));
  const ns = nsResult?.answers?.filter((a) => a.type == 'NS') ?? [];
  const nameServers: DnsNameServerInfo[] = [];
  for (const nsRecord of ns) {
    try {
      const nsName = nsRecord.data;
      const aResult = await resolve(nsName, "A").catch((e) => ({} as DnsResponse));
      const aaaaResult = await resolve(nsName, "AAAA").catch((e) => ({} as DnsResponse));
      const ipv4 = aResult?.answers?.filter((a) => a.type == 'A').map((a) => a.data) ?? [];
      const ipv6 = aaaaResult?.answers?.filter((a) => a.type == 'AAAA').map((a) => a.data) ?? [];
      nameServers.push({ name: nsName, ipv4, ipv6 });
    } catch (e) {
      console.error(`Error resolving NS record ${nsRecord.data}:`, e);
    }
  }

  return {
    zoneName,
    primaryNameServer,
    adminContact,
    serial,
    refresh,
    retry,
    expire,
    minimum,
    nameServers,
  } as DnsZoneInfo;
};

export interface DnsFullResult {
  name: string;
  zone: DnsZoneInfo;
  answers: { [type: string]: DnsAnswer[] };
}

export const resolveFull = async (domainName: string, types: string[]) => {
  const dedupedTypes = [...new Set(types)];
  const origAnswers = new Set<string>();
  for (const type of dedupedTypes) {
    const answers = (await resolve(domainName, type).catch((e) => ({} as DnsResponse)))?.answers ?? [] as DnsAnswer[];
    for (const answer of answers) {
      origAnswers.add(JSON.stringify(answer));
    }
  }

  const zone = await resolveZoneInfo(domainName);

  const answers: { [type: string]: DnsAnswer[] } = {};
  for (const jsonAnswer of origAnswers) {
    const answer = JSON.parse(jsonAnswer) as DnsAnswer;
    const { type } = answer;
    if (!answers[type]) {
      answers[type] = [];
    }
    answers[type].push(answer);
  }
  return {
    name: domainName,
    zone,
    answers,
  } as DnsFullResult;
};

export const resolveFullAuto = async (name: string) => {
  const validity = checkValidity(name);
  if (validity.hostname) {
    return resolveFull(name, ["A", "AAAA"]);
  }
  if (validity.ipv4Address || validity.ipv6Address) {
    const reverseName = validity.ipv4Address ? buildReverseName4(name) : buildReverseName6(name);
    return resolveFull(reverseName, ["PTR"]);
  }

  throw new Error("Invalid hostname or IP address");
};

export const resolve = async (name: string, type: string) => {
  const questions = [
    {
      class: "IN",
      type: type,
      name: name,
    },
  ];
  const startTime = Date.now();
  const packet = await resolver.query(name, type, "GET");
  const endTime = Date.now();
  const queryTime = endTime - startTime;
  const rcode = Reflect.get(packet, "rcode") as string || "NOERROR";
  const answers = (packet.answers || []).map((answer) => {
    const { class: cls, type, name, ttl } = answer;
    if (cls === undefined || type === undefined || name === undefined || ttl === undefined) {
      throw new Error("Invalid answer format");
    }
    if (typeof cls !== "string" || typeof type !== "string" || typeof name !== "string" || typeof ttl !== "number") {
      throw new Error("Invalid answer format");
    }
    const ans: DnsAnswer = {
      class: cls,
      type: type,
      name: name,
      ttl: ttl,
      data: answer.data.toString(),
    };
    return ans;
  });

  return {
    rcode,
    questions,
    answers,
    authorities: (packet.authorities ?? []).map((answer) => {
      const { class: cls, type, name, ttl } = answer;
      if (cls === undefined || type === undefined || name === undefined || ttl === undefined) {
        throw new Error("Invalid answer format");
      }
      if (typeof cls !== "string" || typeof type !== "string" || typeof name !== "string" || typeof ttl !== "number") {
        throw new Error("Invalid answer format");
      }
      return {
        class: cls,
        type: type,
        name: name,
        ttl: ttl,
        data: answer.data.toString(),
      } as DnsAnswer;
    }),
    id: packet.id ?? 0,
    time: endTime,
    queryTime,
  } as DnsResponse;
};

export const answerListToString = (answers: DnsAnswer[]) => {
  const stringifiedAnswers = answers.map(({ class: cls, type, name, ttl, data }) => {
    return [
      name,
      String(ttl),
      cls,
      type,
      data,
    ];
  });

  const maxLengths = [0, 0, 0, 0, 0];
  stringifiedAnswers.forEach((answer) => {
    answer.forEach((part, index) => {
      if (part.length > maxLengths[index]!) {
        maxLengths[index] = part.length;
      }
    });
  });

  const formattedAnswers = stringifiedAnswers.map((answer) => {
    return answer.map((part, index) => {
      return part.padEnd(maxLengths[index]!, " ");
    }).join("  ").trim();
  });

  return formattedAnswers.join("\n") + "\n";
};

const formatDateForDns = (date: number) => {
  const d = new Date(date);
  return `${d.toLocaleString('en-US', {weekday: 'short'})} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()} ${d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC ${d.getFullYear()}`;
};

export const formatDnsResponse = (response: DnsResponse) => {
  const { rcode, questions, answers } = response;
  const formattedQuestions = questions.map(({ class: cls, type, name }) => {
    return `; ${name}  ${cls}  ${type}`;
  }).join("\n");

  const formattedAnswers = answerListToString(answers);

  return `
;; QUESTION SECTION:
${formattedQuestions}

;; ANSWER SECTION:
${formattedAnswers}
;; Query time: ${response.queryTime ?? 0} msec
;; SERVER: ${SERVER} (HTTPS)
;; WHEN: ${formatDateForDns(response.time ?? Date.now())}
`
};

export const callApi = async (routerName: string, method: 'GET' | 'POST', endpoint: string, query: URLSearchParams | null = null) => {
  const url = new URL(`/api/${endpoint}`, `https://${routerName}.looking-glass.nc.menhera.org`);
  if (query) {
    url.search = query.toString();
  }
  const response = await fetch(url.toString(), {
    method,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const doPing = async (routerName: string, host: string) => {
  const query = new URLSearchParams();
  query.append("host", host);
  const response = await callApi(routerName, "GET", "v1/ping", query);
  return response;
};

export const doTraceroute = async (routerName: string, host: string) => {
  const query = new URLSearchParams();
  query.append("host", host);
  const response = await callApi(routerName, "GET", "v1/traceroute", query);
  return response;
};

export const doMtr = async (routerName: string, host: string) => {
  const query = new URLSearchParams();
  query.append("host", host);
  const response = await callApi(routerName, "GET", "v1/mtr", query);
  return response;
};

export const getRoute = async (routerName: string, address: string) => {
  const query = new URLSearchParams();
  query.append("address", address);
  const response = await callApi(routerName, "GET", "v1/bgp/json", query);
  return convertRoute(response.result);
};

export interface RouteOrigin {
  network: string;
  asn: number;
}

export const getOriginAsns = async (routerName: string, address: string): Promise<RouteOrigin[]> => {
  const query = new URLSearchParams();
  query.append("address", address);
  const response = await callApi(routerName, "GET", "v1/bgp/json", query);
  const originAsns: RouteOrigin[] = [];
  for (const path of response.result.paths) {
    const asPathObj = path.aspath;
    if (asPathObj == null) {
      continue;
    }
    const lastSegment = asPathObj.segments[asPathObj.segments.length - 1];
    if (lastSegment.type == 'as-set') {
      for (const lastAsn of lastSegment.list) {
        const network = response.result.prefix || '';
        if (!originAsns.find(asn => asn.asn == Number(lastAsn) && asn.network == network)) {
          originAsns.push({
            network: response.result.prefix || '',
            asn: Number(lastAsn),
          });
        }
      }
    } else {
      const lastAsn = lastSegment.list[lastSegment.list.length - 1];
      const network = response.result.prefix || '';
      if (!originAsns.find(asn => asn.asn == Number(lastAsn) && asn.network == network)) {
        originAsns.push({
          network: response.result.prefix || '',
          asn: Number(lastAsn),
        });
      }
    }
  }
  return originAsns;
};

export const getRouteV4ByAsn = async (routerName: string, asn: string) => {
  const query = new URLSearchParams();
  query.append("asn", asn);
  const response = await callApi(routerName, "GET", "v1/bgp/asn/v4/json", query);
  return convertRoute(response.result);
};

export const getRouteV6ByAsn = async (routerName: string, asn: string) => {
  const query = new URLSearchParams();
  query.append("asn", asn);
  const response = await callApi(routerName, "GET", "v1/bgp/asn/v6/json", query);
  return convertRoute(response.result);
};

export const getRouteAuto = async (routerName: string, value: string) => {
  const validity = checkValidity(value);
  if (validity.ipv4Address || validity.ipv4Prefix) {
    return [await getRoute(routerName, value)];
  }
  if (validity.ipv6Address || validity.ipv6Prefix) {
    return [await getRoute(routerName, value)];
  }
  if (validity.asn) {
    return [await getRouteV4ByAsn(routerName, value), await getRouteV6ByAsn(routerName, value)];
  }
  throw new Error("Invalid IP address or ASN");
};

const convertRoute = (route: any): (Route | RouteSummary)[] => {
  if (null == route) {
    throw new Error("No route found");
  }
  if ('object' !== typeof route) {
    throw new Error("Invalid route format");
  }

  const routes: (Route | RouteSummary)[] = [];
  if ('prefix' in route && route.prefix) {
    const prefix = route.prefix as string;
    const paths = route.paths as any[];
    const network = prefix;
    for (const path of paths) {
      const { locPrf, metric, nexthops, origin, valid, version } = path;
      const asPath = path.aspath?.string as string || '?';
      const pathFrom = path.peer?.type as string || '?';
      const peerId = path.peer?.peerId as string || '?';
      const rpkiState = path.rpkiValidationState as string || '?';
      const community = path.community?.string as string || '';
      const extCommunity = path.extendedCommunity?.string as string || '';
      const selectionReason = path.bestpath?.selectionReason || '';
      const best = path.bestpath?.overall as boolean || false;
      const routeSummary: RouteSummary = {
        network,
        locPrf,
        metric: metric ?? 0,
        asPath,
        nexthops: nexthops.map(((n: any) => n?.ip || '?')),
        used: (nexthops as any[]).some((n: any) => n?.used),
        origin,
        pathFrom,
        peerId,
        valid,
        version,
        best,
        selectionReason
      };
      const routeDetails: Route = {
        ...routeSummary,
        rpkiState,
        community: community.split(' ').map((c) => c.trim()),
        extCommunity: extCommunity.split(' ').map((c) => c.trim()),
      };
      routes.push(routeDetails);
    }
  } else {
    const origRoutes = route?.routes || {} as { [prefix: string]: any[] };
    for (const prefix in origRoutes) {
      const paths = origRoutes[prefix];
      const network = prefix;
      for (const path of paths) {
        const { locPrf, metric, nexthops, origin, valid, version } = path;
        const asPath = path.path as string || '?';
        const pathFrom = path.pathFrom as string || '?';
        const peerId = path.peerId as string || '?';
        const best = 'selectionReason' in path;
        const selectionReason = path.selectionReason || '';
        const routeSummary: RouteSummary = {
          network,
          locPrf,
          metric: metric ?? 0,
          asPath,
          nexthops: nexthops.map(((n: any) => n?.ip || '?')),
          used: (nexthops as any[]).some((n: any) => n?.used),
          origin,
          pathFrom,
          peerId,
          valid,
          version,
          best,
          selectionReason,
        };
        routes.push(routeSummary);
      }
    }
  }
  return routes;
};

export const formatRoute = (routes: (Route | RouteSummary)[]): string => {
  let routeTexts: string[] = [];
  let prevNetwork = '';
  for (const route of routes) {
    let routeText = '';

    if (prevNetwork != route.network) {
      routeText += `${route.network}, version ${route.version}\n`;
    }
    routeText += `  ${route.asPath}\n`;
    routeText += `    ${route.nexthops.join(', ')} from ${route.peerId} ${route.used ? '(used)' : ''}${route.best ? `, best (${route.selectionReason})` : ''}\n`;
    routeText += `      Origin ${route.origin}, localpref ${route.locPrf}, MED ${route.metric}, ${route.valid ? 'valid' : 'invalid'}, ${route.pathFrom}\n`;

    if ('rpkiState' in route) {
      routeText += `    RPKI State: ${route.rpkiState}\n`;
      routeText += `    Community: ${route.community.join(', ')}\n`;
      routeText += `    Extended Community: ${route.extCommunity.join(', ')}\n`;
    }

    routeTexts.push(routeText);
    prevNetwork = route.network;
  }

  return routeTexts.join('\n');
};

export interface RouteSummary {
  network: string;
  locPrf: number;
  metric: number;
  asPath: string;
  nexthops: string[];
  origin: string;
  pathFrom: string;
  peerId: string;
  valid: boolean;
  version: number;
  used: boolean;
  best: boolean;
  selectionReason: string;
}

export interface Route extends RouteSummary {
  rpkiState: string;
  community: string[];
  extCommunity: string[];
}

export interface BaseAddressInfo {
  type: string;
  value: string;
}
export interface IpAddressInfo extends BaseAddressInfo {
  type: 'IPv4' | 'IPv6';
  value: string;
  prefixes: string[];
  reverseHostname: string | null;
  reverseHostnameAddresses: string[];
  reverseZone: DnsZoneInfo | null;
  as: AsInfo[];
}

export interface AsInfo extends BaseAddressInfo {
  type: 'AS';
  value: string;
  as_name: string;
  as_description: string;
  as_country: string;
}

export interface HostnameInfo extends BaseAddressInfo {
  type: 'Hostname';
  value: string;
  ipAddresses: IpAddressInfo[];
  zone: DnsZoneInfo | null;
}

export type AddressInfo = IpAddressInfo | AsInfo | HostnameInfo;

export const getAsInfo = async (routerName: string, asn: number): Promise<AsInfo> => {
  const query = new URLSearchParams();
  query.append("asn", String(asn));
  const response = await callApi(routerName, "GET", "v1/as_info", query);
  const result = response.result as AsInfo;
  result.type = 'AS';
  result.value = String(asn);
  return result;
};

export const getAddressInfo = async (routerName: string, address: string): Promise<AddressInfo> => {
  const validity = checkValidity(address);
  if (validity.hostname) {
    const ipList: string[] = []; // IP addresses or prefixes
    const addresses = await resolveFullAuto(address);
    for (const ip of addresses.answers.A ?? []) {
      ipList.push(ip.data);
    }
    for (const ip of addresses.answers.AAAA ?? []) {
      ipList.push(ip.data);
    }

    const ipAddresses = await Promise.all(ipList.map((ip) => getIpAddressInfo(routerName, ip)));
    const zone = await resolveZoneInfo(address);
    const hostnameInfo: HostnameInfo = {
      type: 'Hostname',
      value: address,
      ipAddresses: ipAddresses,
      zone: zone,
    };

    return hostnameInfo;
  } else if (validity.ipv4Address || validity.ipv6Address || validity.ipv4Prefix || validity.ipv6Prefix) {
    const ipAddressInfo = await getIpAddressInfo(routerName, address);
    return ipAddressInfo;
  } else if (validity.asn) {
    const asn = Number(validity.value ?? address);
    const asInfo = await getAsInfo(routerName, asn);
    return asInfo;
  }

  throw new Error("Invalid DNS name, IP address or ASN");
};

const getIpAddressInfo = async (routerName: string, ip: string): Promise<IpAddressInfo> => {
  const validity = checkValidity(ip);
  const originAsns = await getOriginAsns(routerName, ip);

  let reverseHostname: string | null = null;
  let reverseHostnameAddresses: string[] = [];
  let reverseZone: DnsZoneInfo | null = null;

  let type: 'IPv4' | 'IPv6' = 'IPv4';
  if (validity.ipv6Address || validity.ipv6Prefix) {
    type = 'IPv6';
  }

  if (validity.ipv4Address || validity.ipv6Address) {
    const resolved = await resolveFullAuto(ip);
    reverseZone = resolved.zone;

    if (resolved.answers.PTR && resolved.answers.PTR.length > 0) {
      reverseHostname = resolved.answers.PTR[0]!.data;

      const reverseResult = await resolveFullAuto(reverseHostname!);
      if (reverseResult.answers.A) {
        for (const ip of reverseResult.answers.A) {
          if (!reverseHostnameAddresses.includes(ip.data)) {
            reverseHostnameAddresses.push(ip.data);
          }
        }
      }
      if (reverseResult.answers.AAAA) {
        for (const ip of reverseResult.answers.AAAA) {
          if (!reverseHostnameAddresses.includes(ip.data)) {
            reverseHostnameAddresses.push(ip.data);
          }
        }
      }
    }
  }

  const asInfos: AsInfo[] = [];
  const prefixes = originAsns.map((asn) => asn.network);
  for (const asn of originAsns) {
    const asInfo = await getAsInfo(routerName, asn.asn);
    if (asInfo) {
      asInfos.push(asInfo);
    }
  }
  return {
    type,
    value: ip,
    prefixes: prefixes,
    reverseHostname: reverseHostname,
    reverseHostnameAddresses: reverseHostnameAddresses,
    reverseZone: reverseZone,
    as: asInfos,
  };
};

export const formatIpInfoList = (addressInfo: AddressInfo) => {
  let result = `Info for ${addressInfo.value}:\n`;
  const ipInfoList = [] as IpAddressInfo[];
  const hostnameInfoList = [] as HostnameInfo[];
  const asInfoList = [] as AsInfo[];
  if (addressInfo.type == 'Hostname') {
    const hostnameInfo = addressInfo as HostnameInfo;
    hostnameInfoList.push(hostnameInfo);

    for (const ipInfo of hostnameInfo.ipAddresses) {
      ipInfoList.push(ipInfo);

      for (const asInfo of ipInfo.as) {
        asInfoList.push(asInfo);
      }
    }
  } else if (addressInfo.type == 'IPv4' || addressInfo.type == 'IPv6') {
    const ipInfo = addressInfo as IpAddressInfo;
    ipInfoList.push(ipInfo);

    for (const asInfo of ipInfo.as) {
      asInfoList.push(asInfo);
    }
  } else if (addressInfo.type == 'AS') {
    const asInfo = addressInfo as AsInfo;
    asInfoList.push(asInfo);
  }

  if (hostnameInfoList.length > 0) {
    result += `\n  Hostname Info:`;
  }
  for (const hostnameInfo of hostnameInfoList) {
    result += `\n    Hostname: ${hostnameInfo.value}\n`;
    result += `    Zone: ${hostnameInfo.zone?.zoneName ?? 'N/A'}\n`;
    result += `    Name Servers:\n`;
    for (const ns of hostnameInfo.zone?.nameServers ?? []) {
      result += `      ${ns.name} (${ns.ipv4.concat(ns.ipv6).join(', ')})\n`;
    }
  }

  if (ipInfoList.length > 0) {
    result += `\n  IP Address Info:`;
  }
  for (const ipInfo of ipInfoList) {
    result += `\n    IP Address: ${ipInfo.value}\n`;
    if (ipInfo.reverseHostname) {
      result += `    Reverse Hostname: ${ipInfo.reverseHostname}\n`;
      result += `    Reverse Hostname Addresses: ${ipInfo.reverseHostnameAddresses.join(", ")}\n`;
    }
    result += `    Reverse Zone: ${ipInfo.reverseZone?.zoneName ?? 'N/A'}\n`;
    result += `    Reverse Zone Name Servers:\n`;

    for (const ns of ipInfo.reverseZone?.nameServers ?? []) {
      result += `      ${ns.name} (${ns.ipv4.concat(ns.ipv6).join(', ')})\n`;
    }
    result += `    Prefixes: ${ipInfo.prefixes.join(", ")}\n`;
  }

  if (asInfoList.length > 0) {
    result += `\n  AS Info:\n`;
  }
  for (const asInfo of [... new Set(asInfoList.map(asInfo => JSON.stringify(asInfo)))].map(asInfo => JSON.parse(asInfo) as AsInfo)) {
    result += `    AS${asInfo.value} ${asInfo.as_name} ${asInfo.as_description} (${asInfo.as_country})\n`;
  }
  return result;
};

export const getClientIpv4 = async (): Promise<string> => {
  const res = await fetch("https://v4.ip.menhera.org/");
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (data && data.ip) {
    return data.ip;
  }
  throw new Error("Invalid response from API");
};

export const getClientIpv6 = async (): Promise<string> => {
  const res = await fetch("https://v6.ip.menhera.org/");
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  if (data && data.ip) {
    return data.ip;
  }
  throw new Error("Invalid response from API");
};

