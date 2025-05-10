
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { IPv4, IPv6 } from 'ipaddr.js';

export type HistoryEntry = {
  command: string,
  result: string,
  hostname: string,
  isError?: boolean,
};

export type ValidForms = {
  // DNS hostname
  hostname: boolean,

  ipv4Address: boolean,
  ipv6Address: boolean,

  // single address is also valid as a prefix
  ipv4Prefix: boolean,
  ipv6Prefix: boolean,

  asn: boolean,
};

export type ValidPurpose = {
  // ping, traceroute, mtr (<ipv4address> | <ipv6address> | <hostname>)+
  sendPacket: boolean,

  // bgp ( <ipv4address> | <ipv6address> | <asn> )+
  getRoute: boolean,

  // nslookup ( <ipv4address> | <ipv6address> | <hostname> )+
  dnsLookup: boolean,

  // whois ( <ipv4address> | <ipv6address> | <hostname> | <asn> )+
  whois: boolean,
};

export type Config = {
  routers: {
    [key: string]: {
      name: string,
      description: string,
    },
  }
};

export const fetchConfig = createAsyncThunk('console/fetchConfig', async () => {
  const response = await fetch('/config.json');
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data: Config = await response.json();
  return data;
});

export const checkValidity = (token: string): ValidForms & { value?: string }  => {
  const result: ValidForms & { value?: string } = {
    hostname: false,
    ipv4Address: false,
    ipv6Address: false,
    ipv4Prefix: false,
    ipv6Prefix: false,
    asn: false,
  };

  if (token.match(/\s/)) {
    return result;
  }

  const asnMatch = token.match(/^(?:AS)?([0-9]+)$/i);
  if (asnMatch) {
    result.asn = true;
    result.value = asnMatch[1];
  } else if (IPv4.isValid(token)) {
    result.ipv4Address = true;
    result.ipv4Prefix = true;
    result.value = token;
  } else if (IPv4.isValidCIDR(token)) {
    result.ipv4Prefix = true;
    result.value = token;
  } else if (IPv6.isValid(token)) {
    result.ipv6Address = true;
    result.ipv6Prefix = true;
    result.value = token;
  } else if (IPv6.isValidCIDR(token)) {
    result.ipv6Prefix = true;
    result.value = token;
  } else {
    // DNS token checks
    const dnsTokens = token.replace(/\.$/, '').split('.');
    const dnsOk = dnsTokens.every((v) => {
      return null != v.match(/^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/i);
    });

    if (dnsOk) {
      result.hostname = true;
      result.value = dnsTokens.join('.').toLowerCase();
    }
  }

  return result;
};

Object.defineProperty(globalThis, 'checkValidity', {
  value: checkValidity,
});

export const consoleSlice = createSlice({
  name: 'console',
  initialState: {
    text: '',
    history: [] as HistoryEntry[],
    loading: false,
    scrollOffset: 0,
    isValidInput: false,
    validatedTokens: [] as string[],
    validPurpose: {
      sendPacket: false,
      getRoute: false,
      dnsLookup: false,
      whois: false,
    } as ValidPurpose,
    isHelp: false,
    isClear: false,
    commandName: '',
    config: {} as unknown as Config,
    selectedRouter: '',
    clientIpv4: '',
    clientIpv6: '',
  },

  reducers: {
    updateText(state, action) {
      if (state.loading) return;
      state.text = action.payload.text;
      const text: string = action.payload.text.trim();
      const parts = text.split(/[\s,]+/);

      // This state machine accepts the following:
      // - ( "ping" | "traceroute" | "mtr" ) ( <ipv4address> | <ipv6address> | <hostname> )+
      // - "nslookup" ( <ipv4address> | <ipv6address> | <hostname> )+
      // - ( "show" | "sh" )? ( "bgp" | "route" ) ( <ipv4address> | <ipv6address> | <ipv4prefix> | <ipv6prefix> | <asn> )+
      // - ( "whois" | "ipinfo" )? ( <ipv4address> | <ipv6address> | <ipv4prefix> | <ipv6prefix> | <hostname> | <asn> )+
      // - ( "help" | "?" )
      // - ( "clear" | "cls" )
      //
      // when command name is specified, other purposes are not valid
      let isValid = false;
      let validPurpose: ValidPurpose = {
        sendPacket: false,
        getRoute: false,
        dnsLookup: false,
        whois: false,
      };
      let clear = false;
      let help = false;
      let validatedTokens: string[] = [];
      let part: string;
      let next: string = 'start';
      let commandName: string = '';
      while (parts.length > 0) {
        part = parts.shift() as string;
        if (part === '') {
          continue;
        }
        console.log(`part: ${part}, next: ${next}`);
        if (next === 'start') {
          if (part.match(/^(ping|traceroute|mtr)$/)) {
            next = 'sendPacket';
            commandName = part;
            validPurpose.sendPacket = true;
          } else if (part.match(/^(nslookup)$/)) {
            commandName = 'nslookup';
            next = 'dnsLookup';
            validPurpose.dnsLookup = true;
          } else if (part.match(/^(show|sh)$/)) {
            next = 'getRoute-start'; // accept "bgp" or "route"
            validPurpose.getRoute = true;
          } else if (part.match(/^(bgp|route)$/)) {
            commandName = 'bgp';
            next = 'getRoute';
            validPurpose.getRoute = true;
          } else if (part.match(/^(whois|ipinfo)$/)) {
            commandName = part;
            next = 'whois';
            validPurpose.whois = true;
          } else if (part.match(/^(help|\?)$/)) {
            isValid = true;
            help = true;
            next = 'end';
            continue;
          } else if (part.match(/^(clear|cls)$/)) {
            isValid = true;
            clear = true;
            next = 'end';
            continue;
          } else {
            const valid = checkValidity(part);
            if (valid.ipv4Address || valid.ipv6Address) {
              validatedTokens.push(valid.value as string);
              next = 'token-only';
              validPurpose.sendPacket = true;
              validPurpose.getRoute = true;
              validPurpose.dnsLookup = true;
              validPurpose.whois = true;
            } else if (valid.hostname) {
              validatedTokens.push(valid.value as string);
              next = 'token-only';
              validPurpose.sendPacket = true;
              validPurpose.dnsLookup = true;
              validPurpose.whois = true;
            } else if (valid.ipv4Prefix || valid.ipv6Prefix) {
              validatedTokens.push(valid.value as string);
              next = 'token-only';
              validPurpose.getRoute = true;
              validPurpose.whois = true;
            } else if (valid.asn) {
              validatedTokens.push(valid.value as string);
              next = 'token-only';
              validPurpose.getRoute = true;
              validPurpose.whois = true;
            } else {
              next = 'invalid';
              isValid = false;
              break;
            }
            isValid = true;
          }
          continue;
        }
        if (next === 'sendPacket') {
          const valid = checkValidity(part);
          if (valid.hostname || valid.ipv4Address || valid.ipv6Address) {
            validatedTokens.push(valid.value as string);
            next = 'sendPacket';
            isValid = true;
          } else {
            isValid = false;
            break;
          }
          continue;
        }
        if (next === 'dnsLookup') {
          const valid = checkValidity(part);
          if (valid.hostname || valid.ipv4Address || valid.ipv6Address) {
            validatedTokens.push(valid.value as string);
            next = 'dnsLookup';
            isValid = true;
          } else {
            isValid = false;
            break;
          }
          continue;
        }
        if (next === 'getRoute') {
          const valid = checkValidity(part);
          if (valid.hostname || valid.ipv4Address || valid.ipv6Address || valid.ipv4Prefix || valid.ipv6Prefix || valid.asn) {
            validatedTokens.push(valid.value as string);
            next = 'getRoute';
            isValid = true;
          } else {
            isValid = false;
            break;
          }
          continue;
        }
        if (next === 'getRoute-start') {
          if (part.match(/^(bgp|route)$/)) {
            next = 'getRoute';
            commandName = 'bgp';
          } else {
            isValid = false;
            break;
          }
          continue;
        }
        if (next === 'whois') {
          const valid = checkValidity(part);
          if (valid.hostname || valid.ipv4Address || valid.ipv6Address || valid.ipv4Prefix || valid.ipv6Prefix || valid.asn) {
            validatedTokens.push(valid.value as string);
            next = 'whois';
            isValid = true;
          } else {
            isValid = false;
            break;
          }
          continue;
        }
        if (next === 'token-only') {
          const valid = checkValidity(part);
          if (valid.ipv4Address || valid.ipv6Address) {
            validatedTokens.push(valid.value as string);
            next = 'token-only';
          } else if (valid.hostname) {
            validatedTokens.push(valid.value as string);
            next = 'token-only';
            validPurpose.getRoute = false;
          } else if (valid.ipv4Prefix || valid.ipv6Prefix) {
            validatedTokens.push(valid.value as string);
            next = 'token-only';
            validPurpose.sendPacket = false;
            validPurpose.dnsLookup = false;
          } else if (valid.asn) {
            validatedTokens.push(valid.value as string);
            next = 'token-only';
            validPurpose.dnsLookup = false;
            validPurpose.sendPacket = false;
          } else {
            next = 'invalid';
            isValid = false;
            break;
          }
          if (!validPurpose.sendPacket && !validPurpose.dnsLookup && !validPurpose.getRoute && !validPurpose.whois) {
            isValid = false;
            break;
          }
          isValid = true;
          continue;
        }
        if (next === 'invalid') {
          isValid = false;
          break;
        }
        if (next === 'end') {
          // did not end, so invalid
          isValid = false;
          break;
        }
      }
      state.isValidInput = isValid;
      state.validPurpose = validPurpose;
      state.validatedTokens = validatedTokens;

      console.log(isValid, validPurpose);

      if (!isValid) {
        state.validatedTokens = [];
        state.validPurpose = {
          sendPacket: false,
          getRoute: false,
          dnsLookup: false,
          whois: false,
        };
        return;
      }

      state.isHelp = help;
      state.isClear = clear;

      if (commandName) {
        state.commandName = commandName;
      }
    },

    commitText(state) {
      state.loading = true;
      state.validatedTokens = [];
      state.validPurpose = {
        sendPacket: false,
        getRoute: false,
        dnsLookup: false,
        whois: false,
      };
    },

    clearConsole(state) {
      state.text = '';
      state.loading = false;
      state.isValidInput = false;
      state.validatedTokens = [];
      state.validPurpose = {
        sendPacket: false,
        getRoute: false,
        dnsLookup: false,
        whois: false,
      };
      state.history = [];
      state.scrollOffset = 0;
    },

    showResult(state, action) {
      state.loading = false;
      state.text = '';
      state.isValidInput = false;
      state.validatedTokens = [];
      state.validPurpose = {
        sendPacket: false,
        getRoute: false,
        dnsLookup: false,
        whois: false,
      };
      state.history.push(action.payload);
    },

    setCommandName(state, action) {
      state.commandName = action.payload.commandName;
    },

    scrollTo(state, action) {
      state.scrollOffset = action.payload.offset;
    },

    setSelectedRouter(state, action) {
      console.log('setSelectedRouter', action.payload.router);
      state.selectedRouter = action.payload.router;
    },

    setClientIpv4(state, action) {
      console.log('setClientIpv4', action.payload.ipv4);
      state.clientIpv4 = action.payload.ipv4;
    },

    setClientIpv6(state, action) {
      console.log('setClientIpv6', action.payload.ipv6);
      state.clientIpv6 = action.payload.ipv6;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchConfig.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConfig.fulfilled, (state, action) => {
        state.loading = false;
        state.config = action.payload;
        state.text = '';
      })
      .addCase(fetchConfig.rejected, (state) => {
        state.loading = false;
      });
  },
});
