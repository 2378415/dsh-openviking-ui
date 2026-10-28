/**
 * dsh-openviking-ui — Web client half.
 *
 * Seats:
 *   conversation.chat.turnTail        per-turn write result at the end of a turn
 *   sidebar.footer.action             always-visible entry beside Settings
 *   sidebar.session.row.leading       session dot while the row is idle
 *   sidebar.session.row.hover         one-line detail on the row hover card
 *   settings.section                  cloud-service configuration page
 *   plugins.bundle.config             the same form on the target plugin's page
 *
 * Data arrives from the Host half over one SSE stream, with polling as a
 * fallback. Nothing here computes write status: it renders what the Host
 * observed.
 */

window.__ModuleLoader__.load({
  id: 'dsh-openviking-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'dsh-openviking-ui';
    const API = '/dsh-openviking-ui/api';
    /** OpenViking cloud default; the plugin's own fallback when nothing is set. */
    const CLOUD_DEFAULT = 'https://api.vikingdb.cn-beijing.volces.com/openviking';
    const LOCAL_DEFAULT = 'http://127.0.0.1:1933';

    const DICT = {
      zh: {
        nav: 'OpenViking',
        footerLabel: 'OpenViking',
        sectionTitle: 'OpenViking 云服务',
        sectionHint: '配置 @openviking/dsh-memory-plugin 连接的服务地址与身份。保存后只会热重载该插件，不必重启。',
        endpoint: '服务地址',
        endpointPlaceholder: 'https://api.vikingdb.cn-beijing.volces.com/openviking',
        presetCloud: 'OpenViking 云',
        presetLocal: '本地 (127.0.0.1:1933)',
        presetCustom: '自定义',
        unconfiguredHint: '尚未配置云服务，默认填入 OpenViking 云地址；也可以选本地或填自己的地址。',
        unconfiguredHintActive: '当前没有任何配置，实际生效的是插件默认地址 127.0.0.1:1933（本机没有服务在听）。',
        authMode: '鉴权方式',
        authApiKey: 'API Key',
        authTrusted: '受信身份',
        apiKey: 'API Key',
        apiKeySaved: '已保存，留空表示不修改',
        apiKeyClear: '清除密钥',
        account: 'Account',
        user: 'User',
        save: '保存并应用',
        saving: '保存中…',
        test: '测试连接',
        testing: '测试中…',
        reset: '恢复继承',
        resetHint: '删除本插件写入的配置，回退到环境变量 / ovcli.conf。',
        effective: '当前生效',
        source: '来源',
        writeStatus: '写入状态',
        pendingTotal: '待重试',
        pendingNone: '没有排队的写入',
        notInstalled: '没有找到 openviking-memory-runtime 行：目标插件未安装或未启用。',
        readOnly: '当前宿主没有可用的配置写入能力（缺少 config-editor），只能查看。',
        noData: '还没有可显示的写入记录。',
        connected: '已连接',
        unreachable: '不可达',
        reachableUnauthorized: '服务可达，但未授权（检查 API Key）',
        reachableHttp: '服务可达，返回',
        saved: '已保存并应用',
        savedNotEffective: '已保存，但尚未生效（可能有更高优先级的层覆盖）',
        cleared: '已恢复继承',
        openSettingsHint: '左下角设置 → OpenViking 可修改云服务配置',
        statusWritten: '已写入',
        statusCommitted: '已写入并提交',
        statusQueued: '排队重试',
        statusFailed: '写入失败',
        statusSkipped: '未写入',
        statusPending: '写入中',
        statusIdle: '无写入',
        reasonCaptureOff: '采集已关闭',
        reasonSubagent: '子会话隔离',
        unit: '条',
        recent: '最近',
        invalidEndpoint: '服务地址需要是 http(s) URL',
        trustedIdentity: '受信模式需要 Account 或 User',
        missingEndpoint: '请填写服务地址',
        sessions: '会话',
        retry: '重试',
        queueLabel: '排队',
        okLabel: '成功',
        commitLabel: '提交',
        times: '次',
        updatedAt: '更新于',
        otherApps: '其他程序',
        statsTotal: '共享总计',
        statsRun: '本次运行',
        queueHistory: '历史积压',
        queueThisRun: '本次运行',
        recentOk: '最近成功',
        sessionsTitle: '会话',
        thisProfile: '本项目',
        turnWritten: '本轮已写入',
        turnCommitted: '本轮已写入并提交',
        turnQueued: '本轮未写入 · 已入队',
        turnFailed: '本轮写入失败',
        turnSkipped: '本轮未写入',
        turnRunning: '本轮写入中',
        turnIdle: '本轮无内容可写',
        sessionQueue: '本会话排队',
        clearStats: '清零统计',
        clearedStats: '统计已清零',
        stateOk: '正常，云服务空闲',
        stateBusy: '正在上传到云服务',
        stateErr: '连接不上云服务',
        peerTitle: '项目身份',
        peerSource: '身份来源',
        peerGit: '优先靠 git（默认）',
        peerCwd: '按目录路径',
        peerNone: '不发往项目空间（用户级共享）',
        peerCustom: '自定义模板…',
        peerTemplate: '模板',
        peerTemplateHint: '可用变量：{git_remote} {git_root} {dir} {cwd} {harness}；多个模板用逗号分隔作为回退链',
        peerId: '固定项目 ID',
        peerIdHint: '留空 = 按来源自动推导；填写后会覆盖所有项目自己的 peer.id 设置',
        peerScope: '召回范围',
        peerScopeInherit: '继承（默认：跨项目混合）',
        peerScopeActor: '只本项目',
        peerScopeAll: '跨项目混合（显式写入 all）',
        peerWorkspace: '启用工作区项目身份（关闭后不发送 peer）',
        peerEffective: '当前生效',
        peerNoneSent: '未发送 peer（记忆写到用户级空间）',
        peerSourceExplicit: '固定 ID',
        peerSourceWorkspace: '工作区规则',
        peerSourceNone: '未发送',
        peerNoGitHint: '没有 .git 的目录用「优先靠 git」解析不到项目身份，记忆会落到用户级共享空间；这类项目建议选「按目录路径」或填固定 ID。',
        peerRestartHint: '改动只影响新会话；当前会话建议新开一轮或重启后确认。',
        uiTitle: '界面',
        showCard: '在左侧状态栏显示 OpenViking 卡片',
        showCardHint: '只影响左栏那张卡片；设置页与每轮结尾的状态不受影响。',
      },
      en: {
        nav: 'OpenViking',
        footerLabel: 'OpenViking',
        sectionTitle: 'OpenViking cloud service',
        sectionHint: 'Configure the server and identity used by @openviking/dsh-memory-plugin. Saving hot-reloads only that plugin.',
        endpoint: 'Server',
        endpointPlaceholder: 'https://api.vikingdb.cn-beijing.volces.com/openviking',
        presetCloud: 'OpenViking cloud',
        presetLocal: 'Local (127.0.0.1:1933)',
        presetCustom: 'Custom',
        unconfiguredHint: 'Nothing configured yet; the OpenViking cloud address is filled in. Pick local or type your own if you prefer.',
        unconfiguredHintActive: 'Nothing is configured, so the plugin falls back to 127.0.0.1:1933, where nothing is listening.',
        authMode: 'Authentication',
        authApiKey: 'API key',
        authTrusted: 'Trusted identity',
        apiKey: 'API key',
        apiKeySaved: 'Saved; leave empty to keep it',
        apiKeyClear: 'Clear key',
        account: 'Account',
        user: 'User',
        save: 'Save and apply',
        saving: 'Saving…',
        test: 'Test connection',
        testing: 'Testing…',
        reset: 'Reset to inherited',
        resetHint: 'Remove this plugin’s overrides so env / ovcli.conf apply again.',
        effective: 'Effective',
        source: 'Source',
        writeStatus: 'Write status',
        pendingTotal: 'Queued',
        pendingNone: 'Nothing queued',
        notInstalled: 'No openviking-memory-runtime row: the target plugin is not installed or not enabled.',
        readOnly: 'This host cannot write profile configuration (config-editor missing); read-only.',
        noData: 'No write records yet.',
        connected: 'Connected',
        unreachable: 'Unreachable',
        reachableUnauthorized: 'Reachable, but not authorized (check the API key)',
        reachableHttp: 'Reachable, returned',
        saved: 'Saved and applied',
        savedNotEffective: 'Saved, but not effective yet (a higher-priority layer may override it)',
        cleared: 'Overrides removed',
        openSettingsHint: 'Settings → OpenViking edits the cloud service',
        statusWritten: 'Written',
        statusCommitted: 'Written and committed',
        statusQueued: 'Queued for retry',
        statusFailed: 'Write failed',
        statusSkipped: 'Not written',
        statusPending: 'Writing',
        statusIdle: 'Nothing to write',
        reasonCaptureOff: 'capture is off',
        reasonSubagent: 'isolated subagent',
        unit: 'items',
        recent: 'Recent',
        invalidEndpoint: 'Server must be an http(s) URL',
        trustedIdentity: 'Trusted mode needs an account or user',
        missingEndpoint: 'Enter a server address',
        sessions: 'Sessions',
        retry: 'Retry',
        queueLabel: 'Queued',
        okLabel: 'Written',
        commitLabel: 'Commits',
        times: '×',
        updatedAt: 'Updated',
        otherApps: 'other apps',
        statsTotal: 'Shared total',
        statsRun: 'This run',
        queueHistory: 'Backlog',
        queueThisRun: 'This run',
        recentOk: 'Last success',
        sessionsTitle: 'Sessions',
        thisProfile: 'this project',
        turnWritten: 'Written this turn',
        turnCommitted: 'Written and committed this turn',
        turnQueued: 'Not written — queued',
        turnFailed: 'Write failed this turn',
        turnSkipped: 'Not written this turn',
        turnRunning: 'Writing this turn',
        turnIdle: 'Nothing to write this turn',
        sessionQueue: 'Session queue',
        clearStats: 'Reset stats',
        clearedStats: 'Stats reset',
        stateOk: 'Healthy, idle',
        stateBusy: 'Uploading to OpenViking',
        stateErr: 'Cannot reach OpenViking',
        peerTitle: 'Project identity',
        peerSource: 'Identity source',
        peerGit: 'Git first (default)',
        peerCwd: 'By directory path',
        peerNone: 'Do not send a peer (shared user space)',
        peerCustom: 'Custom template…',
        peerTemplate: 'Template',
        peerTemplateHint: 'Variables: {git_remote} {git_root} {dir} {cwd} {harness}; separate templates with commas as a fallback chain',
        peerId: 'Fixed project ID',
        peerIdHint: 'Empty = derive from the source above; a value overrides every project’s own peer.id',
        peerScope: 'Recall scope',
        peerScopeInherit: 'Inherit (default: cross-project)',
        peerScopeActor: 'This project only',
        peerScopeAll: 'Cross-project (write "all" explicitly)',
        peerWorkspace: 'Use the workspace identity (off = send no peer)',
        peerEffective: 'Effective',
        peerNoneSent: 'No peer sent (memories go to the shared user space)',
        peerSourceExplicit: 'fixed ID',
        peerSourceWorkspace: 'workspace rule',
        peerSourceNone: 'none',
        peerNoGitHint: 'A directory without .git resolves to no peer under "Git first", so its memories land in the shared user space. Pick "By directory path" or a fixed ID for those.',
        peerRestartHint: 'Changes apply to new sessions; reopen the session or restart to confirm.',
        uiTitle: 'Interface',
        showCard: 'Show the OpenViking card in the sidebar',
        showCardHint: 'Only the sidebar card is hidden; the settings page and the per-turn line keep working.',
      },
    };

    /** Populated by `apply`: locale subscription and the translate function. */
    let localeCtx = null;
    let translate = (key) => key;

    const POPOVER_ID = 'dsh-openviking-ui-pop';

    // ── store ────────────────────────────────────────────────────────────
    const CARD_PREF_KEY = 'dsh-openviking-ui.sidebar-card';

    function readCardPref() {
      try {
        return localStorage.getItem(CARD_PREF_KEY) !== '0';
      } catch {
        return true;
      }
    }

    function createStore() {
      const state = {
        rev: -1,
        mode: 'idle',
        error: '',
        cardVisible: readCardPref(),
        config: null,
        pending: { total: 0, attributable: 0, other: 0, historical: 0, current: 0, oldestAt: 0, updatedAt: 0, dir: '' },
        stats: { since: 0, updatedAt: 0, totals: { messages: 0, commits: 0, failures: 0, lastOkAt: 0 }, run: { messages: 0, commits: 0, failures: 0 }, sessions: {} },
        sessions: {},
      };
      const listeners = new Set();
      let source = null;
      let timer = null;
      let idleStop = null;

      const notify = () => {
        for (const listener of listeners) {
          try {
            listener();
          } catch {
            // A failing component must not stop the others.
          }
        }
      };

      const applySnapshot = (data) => {
        if (!data || typeof data !== 'object') return;
        state.rev = Number(data.rev) || 0;
        if (data.config) state.config = data.config;
        if (data.pending) state.pending = { ...state.pending, ...data.pending };
        if (data.stats) state.stats = { ...state.stats, ...data.stats };
        if (Array.isArray(data.sessions)) {
          const next = {};
          for (const session of data.sessions) if (session && session.id) next[session.id] = session;
          state.sessions = next;
        }
        state.error = '';
      };

      const poll = () => {
        fetch(`${API}/status`, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then((response) => response.json())
          .then((data) => {
            if (data && data.ok) {
              applySnapshot(data);
              state.mode = 'poll';
              state.error = '';
            } else {
              state.error = data && data.error ? String(data.error) : 'status_failed';
            }
            notify();
          })
          .catch((error) => {
            state.mode = 'error';
            state.error = String((error && error.message) || error);
            notify();
          });
      };

      const stopSource = () => {
        if (source) {
          try {
            source.close();
          } catch {
            // Already closed.
          }
          source = null;
        }
      };

      const fallback = () => {
        stopSource();
        if (timer) return;
        state.mode = 'poll';
        poll();
        timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          poll();
        }, 4000);
      };

      const start = () => {
        if (idleStop) {
          clearTimeout(idleStop);
          idleStop = null;
        }
        if (source || timer) return;
        if (typeof EventSource !== 'function') {
          fallback();
          return;
        }
        try {
          const stream = new EventSource(`${API}/stream`);
          source = stream;
          stream.addEventListener('snapshot', (event) => {
            try {
              applySnapshot(JSON.parse(event.data));
              state.mode = 'sse';
              state.error = '';
            } catch {
              // Ignore one malformed frame.
            }
            notify();
          });
          stream.addEventListener('session', (event) => {
            try {
              const frame = JSON.parse(event.data);
              if (frame && frame.sessionId && frame.view) {
                state.rev = Number(frame.rev) || state.rev;
                state.sessions = { ...state.sessions, [frame.sessionId]: frame.view };
                notify();
              }
            } catch {
              // Ignore one malformed frame.
            }
          });
          stream.addEventListener('pending', (event) => {
            try {
              const frame = JSON.parse(event.data);
              if (frame && frame.pending) {
                state.rev = Number(frame.rev) || state.rev;
                state.pending = { ...state.pending, ...frame.pending };
                notify();
              }
            } catch {
              // Ignore one malformed frame.
            }
          });
          stream.onerror = () => {
            fallback();
          };
        } catch {
          fallback();
        }
      };

      const stop = () => {
        stopSource();
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        state.mode = 'idle';
      };

      return {
        state,
        subscribe(listener) {
          listeners.add(listener);
          start();
          return () => {
            listeners.delete(listener);
            if (listeners.size === 0 && !idleStop) {
              idleStop = setTimeout(() => {
                idleStop = null;
                if (listeners.size === 0) stop();
              }, 15000);
              if (typeof idleStop.unref === 'function') idleStop.unref();
            }
          };
        },
        refresh() {
          poll();
        },
        setCardVisible(next) {
          state.cardVisible = Boolean(next);
          try {
            localStorage.setItem(CARD_PREF_KEY, state.cardVisible ? '1' : '0');
          } catch {
            // A blocked storage still applies for this page.
          }
          notify();
        },
      };
    }

    const store = createStore();

    // ── hooks and helpers ────────────────────────────────────────────────
    function useStore() {
      const [, force] = React.useReducer((value) => value + 1, 0);
      React.useEffect(() => store.subscribe(force), []);
      return store.state;
    }

    function useT() {
      const [, force] = React.useReducer((value) => value + 1, 0);
      React.useEffect(() => (localeCtx ? localeCtx.locale.subscribe(force) : undefined), []);
      return translate;
    }

    function useStatus() {
      const [status, setStatus] = React.useState(null);
      const [error, setError] = React.useState('');
      const load = React.useCallback(() => {
        fetch(`${API}/status`, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then((response) => response.json())
          .then((data) => {
            if (data && data.ok) {
              setStatus(data);
              setError('');
            } else {
              setError(data && data.error ? String(data.error) : 'status_failed');
            }
          })
          .catch((cause) => setError(String((cause && cause.message) || cause)));
      }, []);
      React.useEffect(() => {
        load();
      }, [load]);
      return { status, error, reload: load };
    }

    async function post(path, body) {
      try {
        const response = await fetch(`${API}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body || {}),
        });
        const data = await response.json().catch(() => ({}));
        return data && typeof data === 'object' ? data : { ok: false, error: 'bad_response' };
      } catch (cause) {
        return { ok: false, error: 'network_error', message: String((cause && cause.message) || cause) };
      }
    }

    function readTurnNo(location) {
      if (typeof location === 'number') return location;
      if (!location || typeof location !== 'object') return null;
      const direct = Number(location.turn ?? location.number ?? location.index);
      if (Number.isFinite(direct)) return direct;
      const nested = location.turn;
      if (nested && typeof nested === 'object') {
        const inner = Number(nested.turn ?? nested.number ?? nested.index);
        if (Number.isFinite(inner)) return inner;
      }
      return null;
    }

    function clockOf(at) {
      if (!at) return '';
      try {
        return new Date(at).toLocaleTimeString(undefined, { hour12: false });
      } catch {
        return '';
      }
    }

    function toneOf(status) {
      if (status === 'written' || status === 'committed') return 'is-ok';
      if (status === 'queued' || status === 'pending') return 'is-warn';
      if (status === 'failed') return 'is-err';
      return 'is-dim';
    }

    function describe(turn, session, t) {
      const queued = Number(session && session.queued) || 0;
      const status = turn && turn.status ? turn.status : 'idle';
      const count = turn && turn.messages ? turn.messages : 0;
      const queueNote = queued > 0 ? `${t('sessionQueue')} ${queued} ${t('unit')}` : '';
      if (status === 'committed') return { tone: 'is-ok', text: `${t('turnCommitted')} ${count} ${t('unit')}`, sub: queueNote };
      if (status === 'written') return { tone: 'is-ok', text: `${t('turnWritten')} ${count} ${t('unit')}`, sub: queueNote };
      if (status === 'queued') {
        return { tone: 'is-warn', text: t('turnQueued'), sub: `${t('sessionQueue')} ${queued || (turn && turn.failures) || 0} ${t('unit')}` };
      }
      if (status === 'failed') return { tone: 'is-err', text: `${t('turnFailed')} ${(turn && turn.error) || ''}`.trim(), sub: '' };
      if (status === 'pending') return { tone: 'is-warn', text: t('turnRunning'), sub: '' };
      if (status === 'skipped') {
        const reason = turn.reason === 'subagent' ? t('reasonSubagent') : t('reasonCaptureOff');
        return { tone: 'is-dim', text: `${t('turnSkipped')} (${reason})`, sub: '' };
      }
      return { tone: 'is-dim', text: t('turnIdle'), sub: '' };
    }

    /** Persisted counters for one session, as the shared stats file holds them. */
    function sessionTotals(session) {
      const stats = (session && session.stats) || {};
      return {
        messages: Number(stats.messages) || 0,
        commits: Number(stats.commits) || 0,
        failures: Number(stats.failures) || 0,
        lastOkAt: Number(stats.lastOkAt) || 0,
      };
    }

    /** One-line description of the peer the running plugin actually resolves. */
    function peerSummary(peer, t) {
      const id = String((peer && peer.peerId) || '');
      if (!id) return t('peerNoneSent');
      const origin = String((peer && peer.origin) || '');
      let source = t('peerSourceNone');
      if (peer && peer.source === 'explicit') source = t('peerSourceExplicit');
      else if (peer && peer.source === 'workspace') source = `${t('peerSourceWorkspace')}${origin ? ` (${origin})` : ''}`;
      return `${id} · ${source}`;
    }

    function sessionTone(session, t) {
      if (!session) return 'is-dim';
      if (Number(session.queued) > 0) return 'is-warn';
      const turn = session.lastTurn;
      if (!turn) return 'is-dim';
      return describe(turn, session, t).tone;
    }

    function turnOf(session, turnNo) {
      if (!session) return null;
      const all = session.turns || [];
      const last = session.lastTurn || (all.length ? all[all.length - 1] : null);
      if (turnNo === null) return last;
      for (let index = all.length - 1; index >= 0; index -= 1) {
        if (all[index].turn === turnNo) return all[index];
      }
      if (last && last.turn === turnNo) return last;
      return null;
    }

    // ── seats ────────────────────────────────────────────────────────────
    function TurnTail(props) {
      const t = useT();
      const state = useStore();
      const sessionId = String(props.sessionId || '');
      const session = state.sessions[sessionId];
      if (!session) return null;
      const turn = turnOf(session, readTurnNo(props.turn));
      if (!turn) return null;
      const view = describe(turn, session, t);
      return h(
        'div',
        { className: 'ovui-tail', 'data-ovui-status': turn.status },
        h('span', { className: `ovui-dot ${view.tone}`, 'aria-hidden': 'true' }),
        h('span', { className: 'ovui-tail-label' }, 'OpenViking'),
        h('span', { className: 'ovui-sep', 'aria-hidden': 'true' }, '·'),
        h('span', { className: 'ovui-tail-text' }, view.text),
        view.sub ? h('span', { className: 'ovui-tail-sub' }, `· ${view.sub}`) : null,
        turn.at ? h('span', { className: 'ovui-time' }, clockOf(turn.at)) : null,
      );
    }

    /** Footer signal: red = cannot reach the service, amber = writing, green = idle. */
    function cardSignal(state) {
      const pending = Number((state.pending || {}).total) || 0;
      const config = (state.config || {}).effective;
      const sessions = state.sessions || {};
      const turns = Object.values(sessions).map((session) => session.lastTurn).filter(Boolean);
      const lastTurn = turns.sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
      const lastWriteAt = Number((state.stats || {}).updatedAt) || 0;
      if (!config || !config.endpoint) return 'is-err';
      if (pending > 0) return 'is-err';
      if (lastTurn && lastTurn.status === 'failed') return 'is-err';
      if ((lastWriteAt > 0 && Date.now() - lastWriteAt < 5000) || (lastTurn && lastTurn.settled === false)) return 'is-warn';
      return 'is-ok';
    }

    function signalLabel(tone, t) {
      if (tone === 'is-err') return t('stateErr');
      if (tone === 'is-warn') return t('stateBusy');
      return t('stateOk');
    }

    function FooterAction(props) {
      const t = useT();
      const state = useStore();
      const wide = props.wide !== false;
      const [open, setOpen] = React.useState(false);
      const [pos, setPos] = React.useState(null);
      const anchorRef = React.useRef(null);

      React.useEffect(() => {
        store.refresh();
        const onVisible = () => {
          if (document.visibilityState === 'visible') store.refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;
        const onDown = (event) => {          if (anchorRef.current && anchorRef.current.contains(event.target)) return;
          const panel = document.getElementById(POPOVER_ID);
          if (panel && panel.contains(event.target)) return;
          setOpen(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
          window.removeEventListener('mousedown', onDown);
          window.removeEventListener('keydown', onKey);
        };
      }, [open]);

      // The panel switch hides this seat only; the settings page and the
      // per-turn line keep working.
      if (!state.cardVisible) return null;

      const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && anchorRef.current) {
          const rect = anchorRef.current.getBoundingClientRect();
          setPos({
            left: Math.max(8, Math.round(rect.left)),
            bottom: Math.max(8, Math.round(window.innerHeight - rect.top + 6)),
          });
        }
      };

      const pending = state.pending || {};
      const stats = state.stats || {};
      const totals = stats.totals || {};
      const run = stats.run || {};
      const queueTotal = Number(pending.total) || 0;
      const updated = Number(pending.updatedAt) || Number(stats.updatedAt) || 0;
      const sessions = Object.values(state.sessions)
        .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
        .slice(0, 4);

      const card = wide
        ? h(
          'div',
          { className: 'ovui-card' },
          h(
            'div',
            { className: 'ovui-card-row' },
            h('span', { className: 'ovui-row-label' }, t('queueLabel')),
            h(
              'span',
              { className: 'ovui-row-value is-queue' },
              String(queueTotal),
              h('span', { className: 'ovui-unit' }, t('unit')),
            ),
          ),
          h(
            'div',
            { className: 'ovui-card-row' },
            h('span', { className: 'ovui-row-label' }, t('okLabel')),
            h(
              'span',
              { className: 'ovui-row-value is-ok' },
              String(Number(totals.messages) || 0),
              h('span', { className: 'ovui-unit' }, t('unit')),
            ),
          ),
          h(
            'div',
            { className: 'ovui-card-foot' },
            h(
              'span',
              { className: 'ovui-foot-left', title: signalLabel(cardSignal(state), t) },
              h('span', { className: `ovui-dot ${cardSignal(state)}` }),
              h('span', { className: 'ovui-foot-label' }, 'OpenViking'),
            ),
            h('span', { className: 'ovui-foot-time' }, `${t('updatedAt')} ${clockOf(updated) || '—'}`),
          ),
        )
        : h(
          'div',
          { className: 'ovui-slim' },
          h('span', { className: `ovui-dot ${cardSignal(state)}` }),
          h('span', { className: 'ovui-slim-count' }, String(queueTotal)),
        );

      const panel = open
        ? h(
          'div',
          { id: POPOVER_ID, className: 'ovui-pop', style: pos ? { left: pos.left, bottom: pos.bottom } : undefined, role: 'dialog', 'aria-label': t('footerLabel') },
          h('div', { className: 'ovui-pop-title' }, `${t('footerLabel')} · ${t('writeStatus')}`),
          h('div', { className: 'ovui-kv' },
            h('span', null, t('statsTotal')),
            h('span', null, `${Number(totals.messages) || 0} ${t('unit')} · ${t('commitLabel')} ${Number(totals.commits) || 0} ${t('times')}`)),
          h('div', { className: 'ovui-kv' },
            h('span', null, t('statsRun')),
            h('span', null, `${Number(run.messages) || 0} ${t('unit')} · ${t('commitLabel')} ${Number(run.commits) || 0} ${t('times')}`)),
          h('div', { className: 'ovui-kv' },
            h('span', null, t('queueLabel')),
            h('span', null, `${queueTotal} · ${t('thisProfile')} ${Number(pending.attributable) || 0} · ${t('otherApps')} ${Number(pending.other) || 0}`)),
          h('div', { className: 'ovui-kv' },
            h('span', null, t('queueHistory')),
            h('span', null, `${Number(pending.historical) || 0} · ${t('queueThisRun')} ${Number(pending.current) || 0}`)),
          h('div', { className: 'ovui-kv' },
            h('span', null, t('recentOk')),
            h('span', null, clockOf(Number(totals.lastOkAt) || 0) || '—')),
          sessions.length
            ? h(
              'div',
              { className: 'ovui-pop-sessions' },
              h('div', { className: 'ovui-pop-subtitle' }, t('sessionsTitle')),
              sessions.map((session) => {
                const totalsOfSession = sessionTotals(session);
                return h(
                  'div',
                  { className: 'ovui-pop-row', key: session.id },
                  h('span', { className: `ovui-dot ${sessionTone(session, t)}` }),
                  h('span', { className: 'ovui-pop-text' },
                    `${totalsOfSession.messages} ${t('unit')} · ${t('commitLabel')} ${totalsOfSession.commits} ${t('times')}`),
                  Number(session.queued) > 0 ? h('span', { className: 'ovui-time' }, `${t('sessionQueue')} ${session.queued}`) : null,
                  h('span', { className: 'ovui-time' }, clockOf(session.lastAt)),
                );
              }),
            )
            : h('div', { className: 'ovui-pop-empty' }, t('noData')),
          h('div', { className: 'ovui-pop-hint' }, t('openSettingsHint')),
        )
        : null;

      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            ref: anchorRef,
            className: wide ? 'ovui-card-wrap' : 'ovui-slim-wrap',
            role: 'button',
            tabIndex: 0,
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': `${t('footerLabel')}: ${t('queueLabel')} ${queueTotal}, ${t('okLabel')} ${Number(totals.messages) || 0}`,
            onClick: toggle,
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
              }
            },
          },
          card,
        ),
        panel,
      );
    }

    function RowLeading(props) {
      const t = useT();
      const state = useStore();
      const session = state.sessions[String(props.sessionId || '')];
      if (!session) return null;
      const totals = sessionTotals(session);
      const queued = Number(session.queued) || 0;
      const label = `${t('okLabel')} ${totals.messages} ${t('unit')} · ${t('commitLabel')} ${totals.commits} ${t('times')} · ${t('sessionQueue')} ${queued} ${t('unit')}`;
      return h('span', {
        className: `ovui-dot ${sessionTone(session, t)}`,
        role: 'img',
        'aria-label': `${t('footerLabel')}: ${label}`,
        title: `${t('footerLabel')} · ${label}`,
      });
    }

    function RowHover(props) {
      const t = useT();
      const state = useStore();
      const session = state.sessions[String(props.sessionId || '')];
      if (!session) return null;
      const totals = sessionTotals(session);
      const queued = Number(session.queued) || 0;
      return h(
        'div',
        { className: 'ovui-hover' },
        h(
          'div',
          { className: 'ovui-hover-line' },
          h('span', { className: `ovui-dot ${sessionTone(session, t)}` }),
          h('span', null, `${t('okLabel')} ${totals.messages} ${t('unit')} · ${t('commitLabel')} ${totals.commits} ${t('times')}`),
        ),
        h(
          'div',
          { className: 'ovui-hover-line is-dim' },
          `${t('sessionQueue')} ${queued} ${t('unit')} · ${t('recentOk')} ${clockOf(totals.lastOkAt) || '—'}`,
        ),
      );
    }

    // ── configuration form ───────────────────────────────────────────────
    function PresetPicker({ endpoint, onPick, t }) {
      const value = endpoint || '';
      const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(value);
      const isCloud = /(vikingdb|volces\.com|openviking\.(ai|com))/i.test(value);
      const current = !value ? 'cloud' : isLocal ? 'local' : isCloud ? 'cloud' : 'custom';
      const options = [
        { id: 'cloud', label: t('presetCloud') },
        { id: 'local', label: t('presetLocal') },
        { id: 'custom', label: t('presetCustom') },
      ];
      return h(
        'div',
        { className: 'ovui-chips', role: 'group' },
        options.map((option) => h(
          'button',
          {
            key: option.id,
            type: 'button',
            className: `ovui-chip${current === option.id ? ' is-active' : ''}`,
            onClick: () => {
              if (option.id === 'cloud') onPick(CLOUD_DEFAULT);
              else if (option.id === 'local') onPick(LOCAL_DEFAULT);
              else onPick(value);
            },
          },
          option.label,
        )),
      );
    }

    function SettingsForm({ compact }) {
      const t = useT();
      const uiState = useStore();
      const { status, error, reload } = useStatus();
      const [endpoint, setEndpoint] = React.useState('');
      const [authMode, setAuthMode] = React.useState('api_key');
      const [apiKey, setApiKey] = React.useState('');
      const [account, setAccount] = React.useState('');
      const [user, setUser] = React.useState('');
      const [clearKey, setClearKey] = React.useState(false);
      const [peerKind, setPeerKind] = React.useState('inherit');
      const [peerTemplate, setPeerTemplate] = React.useState('');
      const [peerId, setPeerId] = React.useState('');
      const [peerScope, setPeerScope] = React.useState('');
      const [workspacePeerOn, setWorkspacePeerOn] = React.useState(true);
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState(null);
      const seeded = React.useRef(false);

      const saved = (status && status.config && status.config.saved) || {};
      const effective = (status && status.config && status.config.effective) || null;
      const livePeer = (status && status.config && status.config.peer) || {};
      // A per-session peer is resolved from that session's workspace; the
      // plugin's own boot-cwd peer is rarely the useful one to show.
      const sessionPeerId = String((status && status.sessions && status.sessions[0] && status.sessions[0].peerId) || '');
      const shownPeer = sessionPeerId
        ? { peerId: sessionPeerId, source: livePeer.source === 'explicit' ? 'explicit' : 'workspace', origin: '' }
        : livePeer;
      const effectiveEndpoint = String((effective && effective.endpoint) || '').replace(/\/+$/, '');
      // Nothing saved, no credential file, and the live value is exactly the
      // plugin's own fallback: this profile has never been configured.
      const unconfigured = Boolean(status)
        && !saved.endpoint && !saved.hasApiKey && !saved.account && !saved.user && !saved.authMode
        && !(effective && effective.credentialPath)
        && effectiveEndpoint === LOCAL_DEFAULT;

      React.useEffect(() => {
        if (seeded.current || !status) return;
        seeded.current = true;
        setEndpoint(saved.endpoint || (unconfigured ? CLOUD_DEFAULT : effectiveEndpoint));
        setAuthMode(saved.authMode || (effective && effective.authMode) || 'api_key');
        setAccount(saved.account || (effective && effective.account) || '');
        setUser(saved.user || (effective && effective.user) || '');
        const rawSource = String(saved.peerSource || '').trim();
        if (!rawSource || rawSource === 'git') {
          setPeerKind('inherit');
        } else if (rawSource === 'cwd' || rawSource === 'none') {
          setPeerKind(rawSource);
        } else {
          setPeerKind('custom');
          setPeerTemplate(rawSource);
        }
        setPeerId(String(saved.peerId || ''));
        setPeerScope(String(saved.recallPeerScope || ''));
        setWorkspacePeerOn(saved.workspacePeer !== false);
      }, [status]);

      if (error) {
        return h('div', { className: 'ovui-section' },
          h('p', { className: 'ovui-error' }, error),
          h('button', { type: 'button', className: 'ovui-btn', onClick: reload }, t('retry')));
      }
      if (!status) return h('div', { className: 'ovui-section' }, h('p', { className: 'ovui-hint' }, '…'));

      const installed = Boolean(status.config && status.config.installed);
      const canWrite = Boolean(status.config && status.config.canWrite);
      if (!installed) return h('div', { className: 'ovui-section' }, h('p', { className: 'ovui-hint' }, t('notInstalled')));

      const run = async (kind) => {
        setBusy(kind);
        setNotice(null);
        try {
          if (kind === 'save') {
            const body = { endpoint, authMode, account, user, clearApiKey: clearKey };
            if (apiKey.trim()) body.apiKey = apiKey.trim();
            body.peerId = peerId.trim();
            body.peerSource = peerKind === 'inherit' ? '' : peerKind === 'custom' ? peerTemplate.trim() : peerKind;
            body.recallPeerScope = peerScope;
            body.workspacePeer = workspacePeerOn ? null : false;
            const result = await post('/config', body);
            if (result.ok) {
              setNotice({ tone: 'ok', text: result.applied ? t('saved') : t('savedNotEffective') });
              setApiKey('');
              setClearKey(false);
              reload();
            } else {
              setNotice({ tone: 'err', text: noticeFor(result, t) });
            }
          } else if (kind === 'test') {
            const body = { endpoint, authMode, account, user };
            if (apiKey.trim()) body.apiKey = apiKey.trim();
            const result = await post('/config/test', body);
            if (result.ok) {
              setNotice({ tone: 'ok', text: `${t('connected')} · ${result.status} · ${result.ms}ms` });
            } else if (result.status === 401 || result.status === 403) {
              setNotice({ tone: 'warn', text: `${t('reachableUnauthorized')} · ${result.status}` });
            } else if (result.status > 0) {
              setNotice({ tone: 'warn', text: `${t('reachableHttp')} ${result.status}` });
            } else {
              setNotice({ tone: 'err', text: `${t('unreachable')} · ${result.error || ''}`.trim() });
            }
          } else if (kind === 'reset') {
            const result = await post('/config/reset', {});
            if (result.ok) {
              setNotice({ tone: 'ok', text: t('cleared') });
              seeded.current = false;
              reload();
            } else {
              setNotice({ tone: 'err', text: noticeFor(result, t) });
            }
          }
        } finally {
          setBusy('');
        }
      };

      const field = (label, control, hint) => h(
        'label',
        { className: 'ovui-field' },
        h('span', { className: 'ovui-label' }, label),
        control,
        hint ? h('span', { className: 'ovui-field-hint' }, hint) : null,
      );

      const authSelect = h(
        'select',
        {
          className: 'ovui-input',
          value: authMode,
          onChange: (event) => setAuthMode(event.target.value),
        },
        h('option', { value: 'api_key' }, t('authApiKey')),
        h('option', { value: 'trusted' }, t('authTrusted')),
      );

      const keyHint = saved.keyHint || (effective && effective.keyHint) || '';
      const keySaved = Boolean(saved.hasApiKey || (effective && effective.hasApiKey));

      return h(
        'div',
        { className: compact ? 'ovui-section ovui-section-compact' : 'ovui-section' },
        !compact && h('h2', { className: 'ovui-title' }, t('sectionTitle')),
        !compact && h('p', { className: 'ovui-hint' }, t('sectionHint')),
        canWrite ? null : h('p', { className: 'ovui-warn' }, t('readOnly')),

        PresetPicker({ endpoint, onPick: setEndpoint, t }),
        unconfigured ? h('p', { className: 'ovui-hint' }, t('unconfiguredHint')) : null,
        field(
          t('endpoint'),
          h('input', {
            className: 'ovui-input',
            type: 'url',
            value: endpoint,
            placeholder: t('endpointPlaceholder'),
            spellCheck: false,
            onChange: (event) => setEndpoint(event.target.value),
          }),
        ),
        unconfigured && endpoint.replace(/\/+$/, '') === LOCAL_DEFAULT
          ? h('p', { className: 'ovui-warn' }, t('unconfiguredHintActive'))
          : null,
        field(t('authMode'), authSelect),
        authMode === 'api_key'
          ? field(
            t('apiKey'),
            h('input', {
              className: 'ovui-input',
              type: 'password',
              value: apiKey,
              autoComplete: 'off',
              placeholder: keySaved ? `${keyHint} — ${t('apiKeySaved')}` : '',
              onChange: (event) => setApiKey(event.target.value),
            }),
            h('span', { className: 'ovui-inline' },
              keySaved ? h('label', { className: 'ovui-check' },
                h('input', { type: 'checkbox', checked: clearKey, onChange: (event) => setClearKey(event.target.checked) }),
                h('span', null, t('apiKeyClear'))) : null),
          )
          : h(
            React.Fragment,
            null,
            field(t('account'), h('input', {
              className: 'ovui-input',
              value: account,
              spellCheck: false,
              onChange: (event) => setAccount(event.target.value),
            })),
            field(t('user'), h('input', {
              className: 'ovui-input',
              value: user,
              spellCheck: false,
              onChange: (event) => setUser(event.target.value),
            })),
          ),

        h(
          'div',
          { className: 'ovui-group' },
          h('div', { className: 'ovui-group-title' }, t('peerTitle')),
          field(
            t('peerSource'),
            h(
              'select',
              { className: 'ovui-input', value: peerKind, onChange: (event) => setPeerKind(event.target.value) },
              h('option', { value: 'inherit' }, t('peerGit')),
              h('option', { value: 'cwd' }, t('peerCwd')),
              h('option', { value: 'none' }, t('peerNone')),
              h('option', { value: 'custom' }, t('peerCustom')),
            ),
          ),
          peerKind === 'custom'
            ? field(
              t('peerTemplate'),
              h('input', {
                className: 'ovui-input',
                value: peerTemplate,
                spellCheck: false,
                placeholder: 'team-{dir}, {git_remote}',
                onChange: (event) => setPeerTemplate(event.target.value),
              }),
              h('span', { className: 'ovui-field-hint' }, t('peerTemplateHint')),
            )
            : null,
          field(
            t('peerId'),
            h('input', {
              className: 'ovui-input',
              value: peerId,
              spellCheck: false,
              placeholder: 'acme-app',
              onChange: (event) => setPeerId(event.target.value),
            }),
            h('span', { className: 'ovui-field-hint' }, t('peerIdHint')),
          ),
          field(
            t('peerScope'),
            h(
              'select',
              { className: 'ovui-input', value: peerScope, onChange: (event) => setPeerScope(event.target.value) },
              h('option', { value: '' }, t('peerScopeInherit')),
              h('option', { value: 'actor' }, t('peerScopeActor')),
              h('option', { value: 'all' }, t('peerScopeAll')),
            ),
          ),
          h(
            'label',
            { className: 'ovui-check' },
            h('input', { type: 'checkbox', checked: workspacePeerOn, onChange: (event) => setWorkspacePeerOn(event.target.checked) }),
            h('span', null, t('peerWorkspace')),
          ),
          h(
            'div',
            { className: 'ovui-kv' },
            h('span', null, t('peerEffective')),
            h('span', null, peerSummary(shownPeer, t)),
          ),
          h('p', { className: 'ovui-hint' }, t('peerNoGitHint')),
          h('p', { className: 'ovui-hint' }, t('peerRestartHint')),
        ),

        h(
          'div',
          { className: 'ovui-actions' },
          h('button', { type: 'button', className: 'ovui-btn is-primary', disabled: Boolean(busy) || !canWrite, onClick: () => run('save') },
            busy === 'save' ? t('saving') : t('save')),
          h('button', { type: 'button', className: 'ovui-btn', disabled: Boolean(busy), onClick: () => run('test') },
            busy === 'test' ? t('testing') : t('test')),
          h('button', { type: 'button', className: 'ovui-btn is-quiet', disabled: Boolean(busy) || !canWrite, onClick: () => run('reset') },
            t('reset')),
        ),
        notice ? h('p', { className: `ovui-notice ${notice.tone === 'ok' ? 'is-ok' : notice.tone === 'warn' ? 'is-warn' : 'is-err'}`, role: 'status' }, notice.text) : null,

        effective
          ? h('div', { className: 'ovui-facts' },
            h('div', { className: 'ovui-fact' },
              h('span', { className: 'ovui-fact-key' }, t('effective')),
              h('span', { className: 'ovui-fact-value' }, effective.endpoint || '—')),
            h('div', { className: 'ovui-fact' },
              h('span', { className: 'ovui-fact-key' }, t('source')),
              h('span', { className: 'ovui-fact-value' },
                [effective.credentialSource, effective.apiKeySource ? `key:${effective.apiKeySource}` : ''].filter(Boolean).join(' · ') || '—')),
          )
          : null,

        h('p', { className: 'ovui-hint' }, t('resetHint')),
        h(
          'div',
          { className: 'ovui-group' },
          h('div', { className: 'ovui-group-title' }, t('uiTitle')),
          h(
            'label',
            { className: 'ovui-check' },
            h('input', {
              type: 'checkbox',
              checked: uiState.cardVisible,
              onChange: (event) => store.setCardVisible(event.target.checked),
            }),
            h('span', null, t('showCard')),
          ),
          h('p', { className: 'ovui-hint' }, t('showCardHint')),
        ),
        compact ? null : h(WriteStatusList, { t }),
      );
    }

    function noticeFor(result, t) {
      if (result && result.errors) {
        if (result.errors.endpoint) return t('invalidEndpoint');
        if (result.errors.authMode === 'trusted_requires_identity') return t('trustedIdentity');
        return Object.keys(result.errors).join(', ');
      }
      if (result && result.message) return result.message;
      return (result && result.error) || 'error';
    }

    function WriteStatusList({ t }) {
      const state = useStore();
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const stats = state.stats || {};
      const totals = stats.totals || {};
      const run = stats.run || {};
      const pending = state.pending || {};
      const sessions = Object.values(state.sessions)
        .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
        .slice(0, 8);

      const reset = async () => {
        setBusy('reset');
        setNotice('');
        const result = await post('/stats/reset', {});
        if (result && result.ok) {
          setNotice(t('clearedStats'));
          store.refresh();
        }
        setBusy('');
      };

      return h(
        'div',
        { className: 'ovui-writes' },
        h('h3', { className: 'ovui-subtitle' }, t('writeStatus')),
        h('div', { className: 'ovui-kv' },
          h('span', null, t('statsTotal')),
          h('span', null, `${Number(totals.messages) || 0} ${t('unit')} · ${t('commitLabel')} ${Number(totals.commits) || 0} ${t('times')} · ${t('recentOk')} ${clockOf(Number(totals.lastOkAt) || 0) || '—'}`)),
        h('div', { className: 'ovui-kv' },
          h('span', null, t('statsRun')),
          h('span', null, `${Number(run.messages) || 0} ${t('unit')} · ${t('commitLabel')} ${Number(run.commits) || 0} ${t('times')}`)),
        h('div', { className: 'ovui-kv' },
          h('span', null, t('queueLabel')),
          h('span', null, `${Number(pending.total) || 0} · ${t('thisProfile')} ${Number(pending.attributable) || 0} · ${t('otherApps')} ${Number(pending.other) || 0}`)),
        h('div', { className: 'ovui-kv' },
          h('span', null, t('queueHistory')),
          h('span', null, `${Number(pending.historical) || 0} · ${t('queueThisRun')} ${Number(pending.current) || 0} · ${t('updatedAt')} ${clockOf(Number(pending.updatedAt) || 0) || '—'}`)),
        sessions.length === 0
          ? h('p', { className: 'ovui-hint' }, t('noData'))
          : sessions.map((session) => {
            const ofSession = sessionTotals(session);
            return h(
              'div',
              { className: 'ovui-write-row', key: session.id },
              h('span', { className: `ovui-dot ${sessionTone(session, t)}` }),
              h('span', { className: 'ovui-write-text' },
                `${ofSession.messages} ${t('unit')} · ${t('commitLabel')} ${ofSession.commits} ${t('times')}${Number(session.queued) > 0 ? ` · ${t('sessionQueue')} ${session.queued}` : ''}`),
              h('span', { className: 'ovui-write-id' }, session.id.slice(0, 8)),
              h('span', { className: 'ovui-time' }, clockOf(session.lastAt)),
            );
          }),
        h('div', { className: 'ovui-actions' },
          h('button', { type: 'button', className: 'ovui-btn is-quiet', disabled: Boolean(busy), onClick: reset, title: 'reset counters' },
            t('clearStats')),
          notice ? h('span', { className: 'ovui-notice is-ok' }, notice) : null),
      );
    }

    function SettingsSection() {
      return h('div', { className: 'ovui-page' }, h(SettingsForm, { compact: false }));
    }

    function PluginCard(props) {
      const t = useT();
      if (props.view === 'summary') {
        return h('div', { className: 'ovui-summary' }, h('span', { className: 'ovui-dot is-ok' }), h('span', null, t('sectionTitle')));
      }
      return h(SettingsForm, { compact: true });
    }

    // ── styles ───────────────────────────────────────────────────────────
    const CSS = `
.ovui-dot{width:6px;height:6px;border-radius:50%;flex:none;display:inline-block;background:var(--dsw-alias-state-idle-primary,#8b949e)}
.ovui-dot.is-ok{background:var(--dsw-alias-state-success-primary,#2ea043)}
.ovui-dot.is-warn{background:var(--dsw-alias-state-warn-primary,#d29922)}
.ovui-dot.is-err{background:var(--dsw-alias-state-error-primary,#f85149)}
.ovui-dot.is-dim{background:var(--dsw-alias-state-idle-primary,#8b949e)}
.ovui-tail{display:flex;align-items:center;gap:6px;padding:2px 2px 0;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary,#8b949e);min-height:16px}
.ovui-tail-label{color:var(--dsw-alias-label-primary,#c9d1d9);font-weight:500}
.ovui-sep{opacity:.5}
.ovui-time{font-variant-numeric:tabular-nums;opacity:.7;font-size:11px;margin-left:2px}
.ovui-foot{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;border-radius:6px;padding:4px 6px;color:var(--dsw-alias-label-secondary,#8b949e);font:inherit;font-size:12px;cursor:pointer}
.ovui-foot:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#c9d1d9)}
.ovui-foot-label{white-space:nowrap}
.ovui-badge{min-width:16px;height:16px;border-radius:8px;padding:0 4px;background:var(--dsw-alias-state-warn-primary,#d29922);color:#1b1b1b;font-size:11px;line-height:16px;text-align:center;font-variant-numeric:tabular-nums}
.ovui-pop{position:fixed;z-index:60;width:260px;padding:10px;border-radius:10px;background:var(--dsw-alias-bg-overlay,#1f2428);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));box-shadow:0 8px 24px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,#c9d1d9);font-size:12px}
.ovui-pop-title{font-weight:600;margin-bottom:8px}
.ovui-pop-row{display:flex;align-items:center;gap:6px;padding:3px 0}
.ovui-pop-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ovui-pop-empty{opacity:.6;padding:4px 0}
.ovui-pop-hint{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));opacity:.65;line-height:16px}
.ovui-hover{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-page{padding:4px 2px 24px;max-width:640px}
.ovui-section{display:flex;flex-direction:column;gap:12px}
.ovui-section-compact{gap:10px}
.ovui-title{margin:0;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary,#c9d1d9)}
.ovui-subtitle{margin:8px 0 0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#c9d1d9)}
.ovui-group{display:flex;flex-direction:column;gap:8px;padding-top:10px;margin-top:2px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.ovui-group-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-warn{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary,#d29922)}
.ovui-error{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}
.ovui-chips{display:flex;gap:6px;flex-wrap:wrap}
.ovui-chip{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));background:transparent;color:var(--dsw-alias-label-secondary,#8b949e);border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}
.ovui-chip.is-active{border-color:var(--dsw-alias-brand-primary,#4c8dff);color:var(--dsw-alias-label-primary,#c9d1d9);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}
.ovui-field{display:flex;flex-direction:column;gap:4px}
.ovui-label{font-size:12px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-input{width:100%;box-sizing:border-box;padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));background:var(--dsw-alias-bg-base,#0d1117);color:var(--dsw-alias-label-primary,#c9d1d9);font:inherit;font-size:13px}
.ovui-input:focus{outline:1px solid var(--dsw-alias-brand-primary,#4c8dff);outline-offset:0}
.ovui-field-hint{font-size:11px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-inline{display:flex;align-items:center;gap:8px;font-size:12px}
.ovui-check{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#8b949e);cursor:pointer}
.ovui-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
.ovui-btn{padding:6px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#c9d1d9);font:inherit;font-size:12px;cursor:pointer}
.ovui-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.5))}
.ovui-btn:disabled{opacity:.5;cursor:default}
.ovui-btn.is-primary{background:var(--dsw-alias-brand-primary,#4c8dff);border-color:transparent;color:#fff}
.ovui-btn.is-quiet{background:transparent;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-notice{margin:0;font-size:12px;line-height:18px}
.ovui-notice.is-ok{color:var(--dsw-alias-state-success-primary,#2ea043)}
.ovui-notice.is-warn{color:var(--dsw-alias-state-warn-primary,#d29922)}
.ovui-notice.is-err{color:var(--dsw-alias-state-error-primary,#f85149)}
.ovui-facts{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.ovui-fact{display:flex;gap:8px;font-size:12px;line-height:18px}
.ovui-fact-key{flex:none;width:72px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-fact-value{word-break:break-all;color:var(--dsw-alias-label-primary,#c9d1d9)}
.ovui-writes{display:flex;flex-direction:column;gap:4px;margin-top:4px}
.ovui-write-summary,.ovui-write-row{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-write-text{color:var(--dsw-alias-label-primary,#c9d1d9)}
.ovui-write-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;opacity:.65}
.ovui-summary{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-card-wrap{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box;min-width:148px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.28));border-radius:12px;padding:8px 10px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06))}
.ovui-card-wrap:hover,.ovui-card-wrap:focus-visible{border-color:var(--dsw-alias-border-l2,rgba(127,127,127,.45));outline:none}
.ovui-card{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box;min-width:0}
.ovui-card-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}
.ovui-row-label{font-size:12px;line-height:18px;font-weight:400;color:var(--dsw-alias-label-secondary,#8b949e);white-space:nowrap}
.ovui-row-value{font-size:12px;line-height:18px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ovui-row-value.is-queue{color:var(--dsw-alias-state-warn-primary,#d29922)}
.ovui-row-value.is-ok{color:var(--dsw-alias-state-success-primary,#2ea043)}
.ovui-unit{font-size:12px;font-weight:400;margin-left:2px;color:inherit;opacity:.85}
.ovui-row-extra{font-size:11px;font-weight:400;margin-left:6px;color:var(--dsw-alias-label-secondary,#8b949e);white-space:nowrap}
.ovui-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary,#8b93a1)}
.ovui-foot-left{display:inline-flex;align-items:center;gap:5px;min-width:0}
.ovui-foot-label{font-size:11px;color:var(--dsw-alias-label-secondary,#8b949e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ovui-foot-time{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;font-variant-numeric:tabular-nums}
.ovui-slim-wrap{display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:10px;padding:6px;min-width:0}
.ovui-slim{display:inline-flex;align-items:center;gap:4px}
.ovui-slim-count{font-size:11px;font-weight:600;color:var(--dsw-alias-label-primary,#c9d1d9);font-variant-numeric:tabular-nums}
.ovui-kv{display:flex;justify-content:space-between;gap:10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#8b949e);padding:2px 0}
.ovui-kv>span:last-child{color:var(--dsw-alias-label-primary,#c9d1d9);text-align:right;word-break:break-word}
.ovui-pop-subtitle{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));font-size:11px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-pop-sessions{display:flex;flex-direction:column}
.ovui-tail-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#8b949e);opacity:.85}
.ovui-hover{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--dsw-alias-label-secondary,#8b949e)}
.ovui-hover-line{display:flex;align-items:center;gap:6px}
.ovui-hover-line.is-dim{opacity:.8}
`;

    // ── plugin ───────────────────────────────────────────────────────────
    /** Render the package stylesheet with the component that needs it. */
    function Styles() {
      return h('style', { 'data-ovui-style': '' }, CSS);
    }

    /** Wrap a seat component so its styles travel with it. */
    function withStyles(Inner) {
      return function StyledSeat(props) {
        return h(React.Fragment, null, h(Styles), h(Inner, props));
      };
    }

    function apply(ctx) {
      localeCtx = ctx;
      try {
        ctx.locale.register(NS, DICT);
      } catch {
        for (const [locale, dict] of Object.entries(DICT)) {
          try {
            ctx.locale.register(NS, locale, dict);
          } catch {
            // One unsupported locale must not stop the plugin.
          }
        }
      }
      // This plugin speaks Chinese. The locale service still owns the
      // dictionaries (and `label` thunks below), but the panel itself resolves
      // from the Chinese dictionary first so a browser-derived English locale
      // cannot turn these labels English behind the user's back.
      translate = (key) => DICT.zh[key] ?? DICT.en[key] ?? key;
      try {
        ctx.locale.subscribe(() => {
          // Keep locale-aware seats (nav labels) fresh without changing text.
        });
      } catch {
        // Locale is optional for the panel.
      }

      const seats = [
        ['conversation.chat.turnTail', { name: 'conversation.chat.turnTail', id: 'openviking-write', order: 30 }, withStyles(TurnTail)],
        ['sidebar.footer.action', { name: 'sidebar.footer.action', id: 'openviking-status', order: 15, label: () => translate('footerLabel') }, withStyles(FooterAction)],
        ['sidebar.session.row.leading', { name: 'sidebar.session.row.leading', id: 'openviking-dot', order: 20 }, withStyles(RowLeading)],
        ['sidebar.session.row.hover', { name: 'sidebar.session.row.hover', id: 'openviking-hover', order: 15 }, withStyles(RowHover)],
        ['settings.section', { name: 'settings.section', id: 'openviking', order: 35, label: () => translate('nav') }, withStyles(SettingsSection)],
        ['plugins.bundle.config', { name: 'plugins.bundle.config', key: '@openviking/dsh-memory-plugin' }, withStyles(PluginCard)],
      ];
      for (const [slot, options, component] of seats) {
        try {
          ctx.slots.inject(slot, () => ctx.slots.register(options, component));
        } catch {
          // A host without this seat simply loses that one surface.
        }
      }
    }

    return { inject: ['slots', 'locale'], apply };
  },
});
