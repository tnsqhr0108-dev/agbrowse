const pages = [
  ['en','Overview','index.html','start overview pages docs'],
  ['en','Quickstart','quickstart.html','install start snapshot web ai'],
  ['en','First Run','quickstart-first-run.html','headed chrome cdp first run'],
  ['en','Changelog','changelog.html','changes release code mode pages'],
  ['en','Architecture','concepts/architecture.html','architecture layers browser web ai'],
  ['en','Browser Runtime','concepts/browser-runtime.html','cdp tabs leases headed'],
  ['en','Web-AI Sessions','concepts/web-ai-sessions.html','sessions resume poll watch'],
  ['en','Web-AI Guide','guides/web-ai.html','send query poll provider'],
  ['en','Code Mode','guides/code-mode.html','code code-extract zip PLAN'],
  ['en','Adaptive Fetch','guides/adaptive-fetch.html','fetch url reader browser'],
  ['en','Source Audit','guides/source-audit.html','source audit claim citations'],
  ['en','CLI Reference','reference/cli.html','commands flags help'],
  ['en','Config Reference','reference/config.html','environment BROWSER_AGENT_HOME'],
  ['en','Release Gates','reference/release-gates.html','test release gates drift'],
  ['ko','개요','ko/index.html','시작 문서 페이지'],
  ['ko','빠른 시작','ko/quickstart.html','설치 시작 스냅샷 웹AI'],
  ['ko','첫 실행','ko/quickstart-first-run.html','크롬 cdp 첫 실행'],
  ['ko','변경 기록','ko/changelog.html','변경 릴리즈 코드모드'],
  ['ko','아키텍처','ko/concepts/architecture.html','구조 브라우저 웹AI'],
  ['ko','브라우저 런타임','ko/concepts/browser-runtime.html','cdp 탭 lease'],
  ['ko','Web-AI 세션','ko/concepts/web-ai-sessions.html','세션 resume poll watch'],
  ['ko','Web-AI 가이드','ko/guides/web-ai.html','send query provider'],
  ['ko','코드 모드','ko/guides/code-mode.html','code code-extract zip PLAN'],
  ['ko','Adaptive Fetch','ko/guides/adaptive-fetch.html','fetch reader 브라우저'],
  ['ko','Source Audit','ko/guides/source-audit.html','출처 감사 citation'],
  ['ko','CLI 레퍼런스','ko/reference/cli.html','명령 플래그 도움말'],
  ['ko','설정 레퍼런스','ko/reference/config.html','환경변수 BROWSER_AGENT_HOME'],
  ['ko','릴리즈 게이트','ko/reference/release-gates.html','테스트 릴리즈 drift']
];

function pathPrefix() {
  const marker = '/dev/';
  const path = window.location.pathname;
  const index = path.indexOf(marker);
  if (index < 0) return '';
  const rest = path.slice(index + marker.length);
  const depth = Math.max(0, rest.split('/').length - 1);
  return '../'.repeat(depth);
}

function currentLang() {
  return document.documentElement.lang === 'ko' ? 'ko' : 'en';
}

function attachSearch() {
  const input = document.querySelector('[data-search]');
  const results = document.querySelector('[data-search-results]');
  if (!input || !results) return;
  const prefix = pathPrefix();
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (!query) return;
    const lang = currentLang();
    const matches = pages
      .filter(([pageLang, title, , keywords]) => pageLang === lang && `${title} ${keywords}`.toLowerCase().includes(query))
      .slice(0, 6);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.textContent = lang === 'ko' ? '검색 결과가 없습니다.' : 'No results.';
      results.append(empty);
      return;
    }
    for (const [, title, href] of matches) {
      const link = document.createElement('a');
      link.href = prefix + href;
      link.textContent = title;
      results.append(link);
    }
  });
}

attachSearch();
