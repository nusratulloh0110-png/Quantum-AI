import type { Language } from "../i18n";
import { Badge } from "../components/Badge";
import { TerminalIcon } from "../components/TerminalIcon";

interface ProductGuideProps {
  language: Language;
}

export const ProductGuide = ({ language }: ProductGuideProps) => {
  const isRu = language === "ru";

  return (
    <div className="view-stack">
      <section className="panel">
        <div className="panel-header">
          <h2>{isRu ? "Что делает продукт" : "What This Product Does"}</h2>
          <Badge tone="success">{isRu ? "Рабочий режим" : "Working mode"}</Badge>
        </div>
        <div className="guide-grid">
          <article className="guide-item">
            <TerminalIcon name="portfolio" size={18} />
            <h3>{isRu ? "Назначение" : "Purpose"}</h3>
            <p>
              {isRu
                ? "Quantum-AI Wealth Guardian считает риск криптопортфеля, показывает концентрацию и формирует целевые веса на базе QUBO/QAOA."
                : "Quantum-AI Wealth Guardian evaluates crypto portfolio risk, concentration and target weights through QUBO/QAOA optimization."}
            </p>
          </article>
          <article className="guide-item">
            <TerminalIcon name="database" size={18} />
            <h3>{isRu ? "Данные" : "Data"}</h3>
            <p>
              {isRu
                ? "Портфель вводится пользователем. Цены, 24h-изменение и поиск монет берутся через локальный API-прокси к CoinGecko."
                : "The user enters portfolio holdings. Prices, 24h change and search come through the local CoinGecko API proxy."}
            </p>
          </article>
          <article className="guide-item">
            <TerminalIcon name="cpu" size={18} />
            <h3>{isRu ? "Квантовый расчет" : "Quantum run"}</h3>
            <p>
              {isRu
                ? "Расчет запускается вручную. Backend строит QUBO, оценивает состояния QAOA и возвращает энергию, bitstring, вероятности и веса."
                : "The run starts manually. The backend builds QUBO, evaluates QAOA states and returns energy, bitstring, probabilities and weights."}
            </p>
          </article>
          <article className="guide-item">
            <TerminalIcon name="product" size={18} />
            <h3>{isRu ? "Ограничение" : "Boundary"}</h3>
            <p>
              {isRu
                ? "Биржевые ордера здесь не отправляются без подключенных ключей. Вкладка исполнения показывает безопасный план перед интеграцией биржи."
                : "Exchange orders are not sent without connected keys. Execution shows a safe plan before exchange integration."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{isRu ? "Порядок работы" : "Workflow"}</h2>
          <span>{isRu ? "От данных к расчету" : "Data to calculation"}</span>
        </div>
        <ol className="instruction-list">
          <li>{isRu ? "Откройте Активы и введите symbol, CoinGecko ID, название и количество." : "Open Assets and enter symbol, CoinGecko ID, name and amount."}</li>
          <li>{isRu ? "Сохраните портфель, чтобы система обновила живые цены и текущие веса." : "Save the portfolio so the system refreshes live prices and current weights."}</li>
          <li>{isRu ? "Откройте Квантовый расчет и нажмите Запустить расчет." : "Open Quantum Run and press Run calculation."}</li>
          <li>{isRu ? "Посмотрите энергию, лучший bitstring, вероятности состояний и целевые веса по активам." : "Review energy, best bitstring, state probabilities and target weights by asset."}</li>
          <li>{isRu ? "Задайте вопрос в AI analytics, если нужен текстовый разбор результата." : "Ask AI analytics if you want a written explanation of the result."}</li>
        </ol>
      </section>
    </div>
  );
};
