// 공공데이터포털 공통 호출 헬퍼: 키 오류(XML 응답)를 사람이 읽을 수 있게 변환
import fetch from 'node-fetch';

const ERROR_MESSAGES = {
  '10': '잘못된 요청 파라미터입니다.',
  '12': '해당 API 서비스가 없거나 폐기되었습니다.',
  '20': '접근 거부: 해당 API 활용신청이 안 되어 있습니다.',
  '22': '일일 트래픽 한도를 초과했습니다.',
  '30': '등록되지 않은 서비스키입니다. (Decoding 키를 쓰고 있는지 확인)',
  '31': '서비스키 활용기간이 만료되었습니다. data.go.kr에서 연장/재신청하세요.',
  '32': '등록되지 않은 IP입니다.',
};

export async function callPublicApi(url, tag = 'publicApi') {
  const safeUrl = url.toString().replace(/ServiceKey=[^&]+/i, 'ServiceKey=***');
  let res;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new Error(`[${tag}] 네트워크 오류: ${e.message.replace(/ServiceKey=[^&\s]+/gi, 'ServiceKey=***')}`);
  }
  const text = await res.text();
  const trimmed = text.trimStart();

  if (trimmed.startsWith('<')) {
    const code = text.match(/<returnReasonCode>(\d+)<\/returnReasonCode>/)?.[1];
    const msg = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1]
      || text.match(/<errMsg>(.*?)<\/errMsg>/)?.[1];
    const friendly = ERROR_MESSAGES[code] || `XML 오류 응답: ${text.slice(0, 200)}`;
    console.error(`[${tag}] ${friendly} (code=${code}, msg=${msg}) url=${safeUrl}`);
    throw new Error(`${friendly} (code=${code})`);
  }
  if (!res.ok) {
    console.error(`[${tag}] HTTP ${res.status}: ${text.slice(0, 300)} url=${safeUrl}`);
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[${tag}] JSON 파싱 실패: ${text.slice(0, 300)}`);
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`);
  }
}
