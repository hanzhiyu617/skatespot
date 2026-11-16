import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PeekRating from './components/PeekRating.jsx';
import SplitText from './components/SplitText.jsx';

const ratingLabels = {
  en: ['Poor', 'Fair', 'Good', 'Great', 'Superb'],
  ko: ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'],
  zh: ['很差', '一般', '还不错', '很好', '非常棒']
};
const voterStorageKey = 'skatespot-rating-voter-v1';

function getVoterId() {
  let voterId = localStorage.getItem(voterStorageKey);
  if (!voterId) {
    voterId = crypto.randomUUID();
    localStorage.setItem(voterStorageKey, voterId);
  }
  return voterId;
}

function RatingWidget({ element }) {
  const [value, setValue] = useState(Number(element.dataset.mine) || 0);
  const [summary, setSummary] = useState({
    average: Number(element.dataset.average) || 0,
    count: Number(element.dataset.count) || 0
  });
  const language = element.dataset.language || 'en';

  async function saveRating(nextValue) {
    const previousValue = value;
    setValue(nextValue);
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId: element.dataset.ratingSpot, voterId: getVoterId(), value: nextValue })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your rating.');
      setSummary({ average: result.average, count: result.count });
    } catch (error) {
      setValue(previousValue);
      window.dispatchEvent(new CustomEvent('skatespot:error', { detail: error.message }));
    }
  }

  return (
    <div className="rating-control">
      <div className="rating-control__stars">
        <PeekRating
          value={value}
          defaultValue={3}
          count={5}
          shape="star"
          labels={ratingLabels[language]}
          activeColor="#f5b400"
          idleColor="#52525b"
          tipColor="#27272a"
          tipTextColor="#f5f5f5"
          size={32}
          lift={7}
          magnify={1.15}
          riseDuration={320}
          popScale={1.3}
          showTip
          allowClear
          ariaLabel={language === 'ko' ? '스팟 평가' : language === 'zh' ? '地点评分' : 'Rate this spot'}
          onChange={nextValue => {
            console.log('rated', nextValue);
            saveRating(nextValue);
          }}
        />
      </div>
      <span className="rating-control__summary" aria-live="polite">
        {summary.count ? `${summary.average.toFixed(1)} · ${summary.count}` : '—'}
      </span>
    </div>
  );
}

const roots = new Map();
let headlineRoot;

function mountWidgets() {
  const headline = document.querySelector('#headline-root');
  if (headline && !headlineRoot) {
    headlineRoot = createRoot(headline);
    headlineRoot.render(
      <SplitText
        text={headline.dataset.text || ''}
        className="headline-animation"
        effect="rise"
        splitType="chars"
        delay={50}
        duration={1.25}
        staggerFrom="start"
        trigger="view"
        hoverEffect="lift"
        loop={false}
        loopDelay={1.5}
        mask={false}
        threshold={0.1}
        rootMargin="-100px"
        textAlign="left"
      />
    );
  }

  document.querySelectorAll('[data-rating-spot]').forEach(element => {
    if (roots.has(element)) return;
    const root = createRoot(element);
    roots.set(element, root);
    root.render(<RatingWidget element={element} />);
  });

  for (const [element, root] of roots) {
    if (element.isConnected) continue;
    root.unmount();
    roots.delete(element);
  }
}

function updateHeadline(event) {
  if (headlineRoot) {
    headlineRoot.render(
      <SplitText
        text={event.detail}
        className="headline-animation"
        effect="rise"
        splitType="chars"
        delay={50}
        duration={1.25}
        staggerFrom="start"
        trigger="view"
        hoverEffect="lift"
        loop={false}
        loopDelay={1.5}
        mask={false}
        threshold={0.1}
        rootMargin="-100px"
        textAlign="left"
      />
    );
  }
}

mountWidgets();
new MutationObserver(mountWidgets).observe(document.body, { childList: true, subtree: true });
window.addEventListener('skatespot:headline', updateHeadline);
