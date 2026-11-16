CREATE TABLE spots (
  id TEXT PRIMARY KEY,
  names JSONB NOT NULL,
  region TEXT NOT NULL,
  type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  descriptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX spots_status_created_at_idx ON spots (status, created_at);

CREATE TABLE ratings (
  spot_id TEXT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL,
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (spot_id, voter_id)
);

INSERT INTO spots (id, names, region, type, lat, lng, descriptions, status) VALUES
  ('seongsu', jsonb_build_object('en', 'Seongsu Skatepark', 'ko', '성수 스케이트파크', 'zh', '圣水滑板公园'), 'Seoul', 'Outdoor', 37.5441, 127.0557, jsonb_build_object('en', 'Concrete bowl, rails and a compact street course.', 'ko', '콘크리트 볼, 레일과 컴팩트한 스트리트 코스.', 'zh', '混凝土碗池、扶手和紧凑街式场地。'), 'approved'),
  ('nanji', jsonb_build_object('en', 'Nanji Hangang Skatepark', 'ko', '난지 한강 스케이트파크', 'zh', '兰芝汉江滑板公园'), 'Seoul', 'Outdoor', 37.5692, 126.8788, jsonb_build_object('en', 'Large riverside park with bowls, banks and ledges.', 'ko', '볼, 뱅크, 렛지가 있는 넓은 강변 파크.', 'zh', '江边大型滑板场，设有碗池、斜台和台阶。'), 'approved'),
  ('songdo', jsonb_build_object('en', 'Songdo Skatepark', 'ko', '송도 스케이트파크', 'zh', '松岛滑板公园'), 'Incheon', 'Outdoor', 37.3863, 126.6404, jsonb_build_object('en', 'Open concrete park near Songdo Central Park.', 'ko', '송도 센트럴파크 인근의 개방형 콘크리트 파크.', 'zh', '松岛中央公园附近的开放式混凝土滑板场。'), 'approved'),
  ('goyang', jsonb_build_object('en', 'Goyang Skatepark', 'ko', '고양 스케이트파크', 'zh', '高阳滑板公园'), 'Gyeonggi', 'Outdoor', 37.6584, 126.832, jsonb_build_object('en', 'Park with transition and beginner-friendly flow.', 'ko', '트랜지션과 초보자 친화적인 플로우를 갖춘 파크.', 'zh', '设有弧面和适合新手的流畅线路。'), 'approved'),
  ('busan', jsonb_build_object('en', 'Busan Citizens Park', 'ko', '부산 시민공원', 'zh', '釜山市民公园'), 'Busan', 'Street', 35.1688, 129.0556, jsonb_build_object('en', 'Public plaza terrain and smooth flatground.', 'ko', '공공 광장 지형과 매끄러운 플랫그라운드.', 'zh', '公共广场地形与平整地面。'), 'approved'),
  ('gangneung', jsonb_build_object('en', 'Gangneung Skatepark', 'ko', '강릉 스케이트파크', 'zh', '江陵滑板公园'), 'Gangwon', 'Outdoor', 37.7519, 128.8761, jsonb_build_object('en', 'Coastal concrete spot with banks and hips.', 'ko', '뱅크와 힙이 있는 해안 콘크리트 스팟.', 'zh', '带斜台与转角的海边混凝土场地。'), 'approved');
