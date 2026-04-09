# Hay Hên - Quay số Vietlott

Ứng dụng web React + Node.js để:

- Xem kết quả Vietlott mới nhất cho `5/35`, `6/45`, `6/55`
- Gợi ý bộ số theo tần suất trong `10`, `20`, `50` kỳ gần nhất
- Xem lịch sử kỳ quay và thống kê kỳ có người trúng jackpot
- Quay số tự chọn theo kiểu lồng quay và tạo cú pháp SMS mua nhanh

## Cong nghe su dung

- Frontend: `React`, `Vite`
- Backend: `Node.js`, `Express`
- Crawl du lieu: `axios`, `cheerio`

## Yeu cau

- `Node.js` 18+ (khuyen nghi LTS moi)
- `npm`

## Cai dat

```bash
npm install
```

Tao file moi truong tu mau:

```bash
cp .env.example .env
```

Neu can goi API o domain rieng (khong dung `/api` cung domain app), dat gia tri:

```env
VITE_API_BASE_URL=https://api-domain-cua-ban.com
```

De trong (mac dinh) thi frontend se goi API noi bo `/api/...`.

## Chay du an (development)

Chay ca frontend va backend cung luc:

```bash
npm run dev
```

Mac dinh:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

## Scripts

- `npm run dev`: chay dong thoi client + server
- `npm run dev:client`: chay Vite frontend
- `npm run dev:server`: chay API server (`server/index.js`)
- `npm run build`: build frontend production
- `npm run preview`: preview ban build
- `npm run lint`: kiem tra lint

## API chinh

- `GET /api/health`
- `GET /api/vietlott/5-35`
- `GET /api/vietlott/6-45`
- `GET /api/vietlott/6-55`
- `GET /api/vietlott/jackpot-winners`

## Cau truc thu muc

```text
.
|-- src/               # Frontend React
|-- server/            # Backend API + crawl Vietlott
|-- public/
|-- package.json
```

## Luu y

- Du lieu duoc lay tu trang Vietlott va co bo nho dem ngan han tren server.
- Cac tinh nang "Mua ngay" su dung link `sms:` de mo ung dung nhan tin tren thiet bi.

## License

Du an su dung license MIT. Xem file `LICENSE` de biet them chi tiet.
