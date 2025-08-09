import express from "express";
import {GoogleGenerativeAI} from "@google/generative-ai";
import axios from "axios";

var router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// API 키가 제대로 로드되는지 확인 (디버깅용, 실제 배포 시 제거 또는 적절히 처리)
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.");
    router.use((req,
                res) => res.status(500).json({error: "API 키가 설정되지 않았습니다."}));
} else {
    console.log("GEMINI_API_KEY가 성공적으로 로드되었습니다."); // 키 로드 확인 메시지
}

// GoogleGenerativeAI 인스턴스 생성
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

router.post("/generate", async (req, res) => {
    try {
        const params = {
            farmName:'테스트',
            testDate:'2025-06-19'
        }

        // kubernetes port 30000 으로 설정
        const response = await axios.post('http://woosso-service:8080/api/cow/selectAll', params);
        const cowData = JSON.stringify(response.data[0].DATA, null, 2);

        if (!cowData) {
            return res.status(400).json({error: "데이터가 제공되지 않았습니다."});
        }

        //기본 프롬프트
        const basic_prompt =
            "당신은 낙농전문 컨설턴트입니다. 사용자에게 명확하고 실용적인 정보를 제공하며, 불필요한 기술적 설명(변수, DB 정보, KEY 등 보완 관련 내용)은 응답에 포함하지 않습니다.\n"
        ;

        const milk_standard =
            "유성적 문제 판단이 필요할 경우 다음 기준을 참고합니다. \n" +
            "1. 목장 평균 데이터를 기준 데이터와 비교하여 이상 징후 및 추세를 진단합니다.\n" +
            "2. 기준 데이터보다 우수한 항목의 개체별 문제는 무시합니다.\n" +
            "3. 우수하지 않은 항목의 젖소 개체(shortName)에 대해 핵심 문제와 구체적 해결 방안을 제시합니다.\n" +
            "** 기준 데이터 **\n" +
            "  - 305일 유량: 10500KG\n" +
            "  - 월 평균 유량: 35KG\n" +
            "  - 월 평균 유지율: 4.0%\n" +
            "  - 월 평균 유단백: 3.2%\n" +
            "  - 월 평균 무지고형분: 8.75%\n" +
            "  - 도태산차: 2.7\n" +
            "  - 2산 생존율: 65%\n" +
            "  - 3산 생존율: 45%"
        ;



        //건강관리 기준
        const health_standard =
            "건강 문제 판단이 필요할 경우 다음 기준을 참고합니다. \n" +
            "  - **유단백/유지방 비율:** 분만 극초기 착유우(분만 후 2주 이내)를 제외하고, 나머지 젖소들은 유단백/유지방 비율이 **1.05 이상**이어야 합니다. 이는 과산증(루멘 산성증) 예방에 중요합니다.\n" +
            "  - **최적 유단백/유지방 비율:** 해당 비율이 너무 높으면 (예: 1.25 이상) 유량 감소 및 유지율 과도 증가를 유발하여 에너지 불균형이나 케토시스 같은 대사성 질환 가능성을 시사할 수 있습니다. 경제적인 관점에서 최적의 유량과 건강을 위해서는 일반적으로 **1.05에서 1.25 사이의 비율**을 유지하는 것이 바람직합니다.\n" +
            "  - **분만 극초기 특이사항:** 분만 직후에는 젖소의 사료 섭취량이 부족하고 몸의 변화가 크기 때문에 일시적으로 유지방이 높게 나타나 유단백/유지방 비율이 낮아질 수 있으며, 이는 정상적인 생리 현상일 수 있습니다."
        ;

        //번식관리 기준
        const breeding_standard =
            "번식 문제 판단이 필요할 경우 다음 기준을 참고합니다. \n" +
            " - 모든 개체의 평균 공태일수가 180일 이상이거나, 각 개체의 공태일수가 200일 이상인 경우 구체적인 대책을 제시합니다. \n"
        ;

        //유대 계산 기준
        const money_standard =
            "유대 계산이 필요할 경우 다음 기준을 참고합니다. 원유의 1kg은 약 0.97L로 환산하여 계산합니다.\n" +
            "목장의 음용유 기본가격은 1084원/L 이고 가공유용 가격은 882원/L 입니다.\n" +
            "원유총량의 88.5%는 음용유로, 5.0%는 가공유로 계산하며, 나머지 6.5%는 해당 시점의 탈지분유 국제경쟁가격으로 계산합니다.\n" +
            "\n" +
            "유성분 함량별 가격:\n" +
            "  - 유지방: 3.0%이하 -129원/L, 3.1% -67원/L, 3.2% -56원/L, 3.3% -46원/L, 3.4% -36원/L, 3.5% 0원/L, 3.6% 10원/L, 3.7% 20원/L, 3.8%이상 30원/L\n" +
            "  - 유단백: 3.0%미만 0원/L, 3.0% 4원/L, 3.1% 11원/L, 3.2%이상 19원/L\n" +
            "\n" +
            "위생 등급별 가격:\n" +
            "  - 체세포수 (단위: 개/㎖): 200,000 이하 52원/L, 200,001~350,000 미만 39원/L, 350,001~500,000 미만 0원/L\n" + // 단위 및 범위 명확화
            "  - 세균수 (단위: 개/㎖): 30,000 미만 52원/L, 30,000~100,000 미만 36원/L, 100,000~250,000 미만 3원/L, 250,000~500,000 미만 -15원/L\n" +
            "\n" +
            "주의: 체세포수 500,000개/㎖ 이상 또는 세균수 500,000개/㎖ 초과 시에는 원유 기본가격, 유성분 함량별 가격, 위생등급별 가격과 관계없이 탈지분유 국제경쟁가격이 적용됩니다."
        ;

        //변수설명
        const description =
            "**주의: 변수에 대한 설명은 다음을 참고하되 응답에 절대로 변수명이 포함되지 않아야 합니다. \n" +
            "regNumber; // 젖소의 등록 번호 (고유 식별자)\n" +
            "name; // 젖소의 명호 (이름)\n" +
            "shortName; // 젖소의 농장에서 주로 부르는 번호\n" +
            "birthDate; // 젖소의 생년월일\n" +
            "farmName; // 목장 이름\n" +
            "calvingDate; // 최근 분만일\n" +
            "dryOffDate; // 최근 건유일\n" +
            "openDays; // 공태 일수 (분만후부터 수정전까지 기간)\n" +
            "lastBreedingDate; // 최종 수정일자\n" +
            "lastBreedingCount; // 최종 수정 횟수\n" +
            "lastSemenCode; // 최종 수정 정액 코드\n" +
            "daysToFirstBreeding; // 분만 후 첫 수정일까지 일수\n" +
            "\n" +
            "test_date; // 최신 검정일 (젖소의 상태를 검사한 날짜)\n" +
            "milkYield; // 최신 유량 (가장 최근 검정일의 우유 생산량)\n" +
            "fatPct; // 최신 유지율 (가장 최근 검정일의 우유 지방 함량 비율)\n" +
            "proteinPct; // 최신 유단백질 (가장 최근 검정일의 우유 단백질 함량 비율)\n" +
            "snfPct; // 무지고형분율 (지방을 제외한 우유 고형분 비율)\n" +
            "scc; // 최신 체세포수 (가장 최근 검정일의 우유 체세포 수, 단위 천개)\n" +
            "mun; // 최신 MUN (Milk Urea Nitrogen) 값 (우유 요소 질소 값)\n" +
            "yield305; // 305일 유량 (305일 동안의 총 우유 생산량)\n" +
            "fat305; // 305일 유지량 (305일 동안의 총 우유 지방량)\n" +
            "protein305; // 305일 유단백 (305일 동안의 총 우유 단백질량)\n" +
            "snf305; // 305일 무지고형분량 (305일 동안의 총 무지고형분량)\n" +
            "meYield; // 성년형 유량 (젖소가 성숙했을 때의 예상 유량)\n" +
            "meFat; // 성년형 유지량 (젖소가 성숙했을 때의 예상 유지량)\n" +
            "meProtein; // 성년형 유단백량 (젖소가 성숙했을 때의 예상 유단백량)\n" +
            "meSnf; // 성년형 무지고형분량 (젖소가 성숙했을 때의 예상 무지고형분량)\n" +
            "peakScc; // 최고 유량 체세포 (유량이 최고치일 때의 체세포 수)\n" +
            "\n" +
            "parity; // 산차 (젖소가 송아지를 낳은 횟수)\n" +
            "DaysAtLact; // 현재 산차의 누적 착유 일수 (현재 젖소가 우유를 생산한 총 일수)\n" +
            "prevLactPersistence; // 전산차 비유 지속성 (이전 산차의 우유 생산 지속 능력)\n" +
            "currLactPersistenceAtLact; // 해당 산차의 비유 지속성 (현재 산차의 우유 생산 지속 능력)\n" +
            "daysToPeak; // 비유 최고 도달일수 (우유 생산량이 최고치에 도달하는 데 걸린 일수)\n" +
            "latePeakYield; // 비유 후기 최고 유량 (비유 후반기에 도달한 최고 우유 생산량)\n" +
            "earlyAvgFat; // 비유 초기 평균 유지율 (비유 초반기의 평균 우유 지방 함량 비율)\n" +
            "earlyAvgProtein; // 비유 초기 평균 단백율 (비유 초반기의 평균 우유 단백질 함량 비율)\n" +
            "earlyAvgMun; // 비유 초기 평균 MUN (비유 초반기의 평균 우유 요소 질소 값)\n" +
            "lastYieldDryOff; // 건유 전 마지막 유량 (젖소를 건유하기 전 마지막으로 측정된 우유 생산량)\n" +
            "prevLactDryOffYield; // 전산차 건유 전 유량 (이전 산차에서 건유하기 전 마지막으로 측정된 우유 생산량)";

        const before_response =
            ""
        ;

        const model = genAI.getGenerativeModel({model: "gemini-2.5-flash-lite-preview-06-17"});

        // prompt를 contents 배열 형식으로 변경합니다.
        const contents = [
            {
                role: 'user',
                parts: [
                    {text: basic_prompt},
                    {text: milk_standard},
                    {text: health_standard},
                    {text: breeding_standard},
                    {text: money_standard},
                    {text: description},
                    {text: cowData},
                    {text: before_response},
                    {text: "데이터 잘 읽고 있는지 테스트"},
                ],
            },
        ];

        // 모델 인스턴스에서 generateContent를 호출합니다.
        const result = await model.generateContent({contents: contents});

        // 결과에서 텍스트 추출 방식도 올바르게 확인
        const responseText = result.response.text();

        res.json({response: responseText});

    } catch (error) {
        console.error("Gemini API 호출 중 오류 발생:", error);
        res.status(500).json({
            error: {
                message: "API 호출 중 오류가 발생했습니다. 라이브러리 사용법을 다시 확인해주세요.",
                details: error.message,
                stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
            }
        });
    }
});

export default router;