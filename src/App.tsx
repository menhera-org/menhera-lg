
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, useAppDispatch } from './app/store';
import { drawerSlice } from './ui/drawer';

import { DrawerToggleButton } from './components/DrawerToggleButton';
import { TopBarNavigationControl } from './components/TopBarNavigationControl';
import { ShortcutItem } from './components/ShortcutItem';
import { checkValidity, consoleSlice, fetchConfig } from './ui/console';
import { KeyboardEvent } from 'react';
import { ScrollBox } from './components/ScrollBox';
import { resolveAuto, formatDnsResponse, DnsResponse, getRouteAuto, doPing, doTraceroute, doMtr, formatRoute, getAddressInfo, formatIpInfoList, getClientIpv4, getClientIpv6 } from './app/api';

export const App = () => {
  const drawerIsOpen = useSelector((state: RootState) => state.drawer.open);
  const direction = useSelector((state: RootState) => state.direction.direction);
  const scrollOffset = useSelector((state: RootState) => state.console.scrollOffset);
  const consoleHistory = useSelector((state: RootState) => state.console.history);
  const consoleText = useSelector((state: RootState) => state.console.text);
  const validPurpose = useSelector((state: RootState) => state.console.validPurpose);
  const commandName = useSelector((state: RootState) => state.console.commandName);
  const isValid = useSelector((state: RootState) => state.console.isValidInput);
  const args = useSelector((state: RootState) => state.console.validatedTokens);
  const loading = useSelector((state: RootState) => state.console.loading);
  const config = useSelector((state: RootState) => state.console.config);
  const selectedRouter = useSelector((state: RootState) => state.console.selectedRouter);
  const clientIpv4 = useSelector((state: RootState) => state.console.clientIpv4);
  const clientIpv6 = useSelector((state: RootState) => state.console.clientIpv6);
  const dispatch = useAppDispatch();
  const mainRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    getClientIpv4().then((ipv4) => {
      dispatch(consoleSlice.actions.setClientIpv4({ ipv4 }));
    }).catch((e) => {
      dispatch(consoleSlice.actions.setClientIpv4({ ipv4: '' }));
    });

    getClientIpv6().then((ipv6) => {
      dispatch(consoleSlice.actions.setClientIpv6({ ipv6 }));
    }).catch((e) => {
      dispatch(consoleSlice.actions.setClientIpv6({ ipv6: '' }));
    });
  }, []);

  useEffect(() => {
    if (config.routers == null || Object.keys(config.routers).length === 0 && !loading) {
      dispatch(fetchConfig());
    }
  }, [config, loading]);

  const commands: { [key: string]: { label: string, } } = {};
  commands['ipinfo'] = {
    label: 'IP Info',
  };

  commands['ping'] = {
    label: 'Ping',
  };

  commands['traceroute'] = {
    label: 'Traceroute',
  };

  commands['mtr'] = {
    label: 'MTR',
  };

  commands['bgp'] = {
    label: 'BGP',
  };

  commands['nslookup'] = {
    label: 'DNS Lookup',
  };

  commands['whois'] = {
    label: 'Whois',
  };

  useEffect(() => {
    const commandKeys = Object.keys(commands);
    if (commandKeys.length > 0 && (!commandName || !commandKeys.includes(commandName))) {
      dispatch(consoleSlice.actions.setCommandName({ commandName: commandKeys[0] }));
    }
  }, [commands, commandName]);

  useEffect(() => {
    const routers = Object.keys(config.routers ?? {});
    if (routers.length > 0 && (!selectedRouter || !routers.includes(selectedRouter))) {
      dispatch(consoleSlice.actions.setSelectedRouter({ router: routers[0] }));
    }
  }, [selectedRouter, config]);

  const exec = () => {
    // not implemented
    let displayedCommand = commandName;
    if (displayedCommand === 'bgp') {
      displayedCommand = 'show bgp';
    }
    const displayedArgs = args.map((arg) => {
      const validity = checkValidity(arg);
      if (validity.asn) {
        return `AS${validity.value ?? 0}`;
      }
      return arg;
    });

    const command = [displayedCommand, ... displayedArgs].join(' ');
    switch (commandName) {
      case 'nslookup': {
        const entries = [... args];
        nslookup(entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }

      case 'bgp': {
        const entries = [... args];
        bgp(selectedRouter, entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }

      case 'ping': {
        const entries = [... args];
        ping(selectedRouter, entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }

      case 'traceroute': {
        const entries = [... args];
        traceroute(selectedRouter, entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }

      case 'mtr': {
        const entries = [... args];
        mtr(selectedRouter, entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }

      case 'ipinfo': {
        const entries = [... args];
        ipinfo(selectedRouter, entries).then((result) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: result,
            hostname: selectedRouter,
          }));
        }).catch((e) => {
          dispatch(consoleSlice.actions.showResult({
            command: command,
            result: String(e),
            hostname: selectedRouter,
            isError: true,
          }));
        });
        return;
      }
    }

    dispatch(consoleSlice.actions.showResult({
      command: command,
      result: 'Not implemented',
      hostname: selectedRouter,
      isError: true,
    }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!isValid) {
        return;
      }
      dispatch(consoleSlice.actions.commitText());
      exec();
    }
    if (e.key === 'ArrowUp') {
      // todo
    }
    if (e.key === 'ArrowDown') {
      // todo
    }
  };

  return (
    <div id="app" className={drawerIsOpen ? 'app-drawer-open' : 'app-drawer-closed'} dir={direction}>
      <div id="app-top-bar">
        <div id="app-top-bar-side">
          <DrawerToggleButton />
          <div id="app-top-bar-branding">
            <div id="app-top-bar-branding-logo"></div>
          </div>
        </div>
        <div id="app-top-bar-main">
          <TopBarNavigationControl title="AS63806 Looking Glass" />
        </div>
      </div>
      <ScrollBox id="app-main" onScrollOffsetChange={(offset) => consoleSlice.actions.scrollTo({ offset })} scrollOffset={scrollOffset} scrollOrigin='end'>
        <div className="infobox">
          <h1>AS63806 Looking Glass</h1>
          <h2>Notice</h2>
          <p>This service is provided for informational purposes only. Any automated use of the service is prohibited.</p>
          <p>Access to this service is logged and monitored.</p>
          <p>By using this service, you agree to the above terms.</p>
          <h2>Your IP address</h2>
          <p>IPv4: {clientIpv4}</p>
          <p>IPv6: {clientIpv6}</p>
        </div>
        <div id="console-history">{
          consoleHistory.map((ent, i) => {
            return <React.Fragment key={`entry-${i}`}>
              <div className="console-history-command" key={`command-${i}`}>{`${ent.hostname} > ${ent.command}`}</div>
              <div className={`console-history-result ${ent.isError ? 'error' : ''}`} key={`result-${i}`}>{ent.result}</div>
            </React.Fragment>
          })
        }</div>
        <div id="console-input-wrapper" className={isValid ? 'valid' : 'invalid'} data-disabled={loading}>
          <select id="console-input-command-select"
            ref={commandRef}
            onChange={(e) => dispatch(consoleSlice.actions.setCommandName({ commandName: (e.target as HTMLSelectElement).value }))}
            value={commandName}
            disabled={loading}
          >
            {
              Object.keys(commands).map((key) => {
                return <option value={key} key={key}>{commands[key]!.label}</option>
              })
            }
          </select>
          <select id="console-input-router-select"
            onChange={(e) => dispatch(consoleSlice.actions.setSelectedRouter({ router: (e.target as HTMLSelectElement).value }))}
            value={selectedRouter}
            disabled={loading}
          >
            {
              Object.keys(config.routers ?? {}).map((key) => {
                return <option value={key} key={key}>{config.routers[key]!.description}</option>
              })
            }
          </select>
          <div id="console-input-args">
            <span className="material-symbols-outlined">{"double_arrow"}</span>
            <input type="text" id="console-input-field"
              onInput={(e) => dispatch(consoleSlice.actions.updateText({ text: (e.target as HTMLInputElement).value }))}
              onKeyDown={(e) => onKeyDown(e)}
              value={consoleText}
              disabled={loading}
              placeholder="IPv4/IPv6, domain name, or ASN"
            />
            <button id="console-input-exec-button"
              onClick={() => {
                if (!isValid) {
                  return;
                }
                dispatch(consoleSlice.actions.commitText());
                exec();
              }}
              disabled={loading}
            >
              <span className="material-symbols-outlined">play_arrow</span>
            </button>
          </div>
        </div>
      </ScrollBox>
      <div id="app-overlay" onClick={() => dispatch(drawerSlice.actions.closeDrawer())}></div>
      <div id="app-drawer">
        <div id="app-drawer-shortcuts">
          <ShortcutItem selected={true} href="/" icon="public" text="LG" />
          <ShortcutItem selected={false} href="https://www.nc.menhera.org/" icon="people" text="NOC" />
        </div>
        <div id="app-drawer-navigation">
          <h1 id="app-drawer-heading">AS63806 Looking Glass</h1>
          <ul>
            <li>
              <a href="https://www.peeringdb.com/net/34545" target="_blank" rel="noreferrer">PeeringDB</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const nslookup = async (entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map((entry) => {
    return resolveAuto(entry);
  }));

  const result = results.map((ans) => {
    return Object.values(ans).filter((response) => response != null) as DnsResponse[];
  }).map((answerList) => {
    return answerList.map((answer) => {
      return formatDnsResponse(answer);
    });
  }).flat().join('\n');

  return result;
};

const bgp = async (routerName: string, entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map((entry) => {
    return getRouteAuto(routerName, entry);
  }));

  const result = results.flat().map((ans) => {
    return formatRoute(ans);
  }).join('\n\n');

  return result;
};

const ping = async (routerName: string, entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map((entry) => {
    return doPing(routerName, entry);
  }));

  const result = results.map((ans) => {
    return ans.result as string;
  }).join('\n\n');

  return result;
};

const traceroute = async (routerName: string, entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map((entry) => {
    return doTraceroute(routerName, entry);
  }));

  const result = results.map((ans) => {
    return ans.result as string;
  }).join('\n\n');

  return result;
};

const mtr = async (routerName: string, entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map((entry) => {
    return doMtr(routerName, entry);
  }));

  const result = results.map((ans) => {
    return ans.result as string;
  }).join('\n\n');

  return result;
};

const ipinfo = async (routerName: string, entries: string[]): Promise<string> => {
  const results = await Promise.all(entries.map(async (entry) => {
    const addressInfo = await getAddressInfo(routerName, entry);
    const result = formatIpInfoList(addressInfo);
    return result;
  }));

  return results.join('\n\n');
};
