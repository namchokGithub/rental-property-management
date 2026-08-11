# คู่มือ Deploy เว็บ Static

เอกสารนี้ตั้งใจให้แชร์ต่อได้ จึงไม่มีชื่อบัญชี, ชื่อ repository, URL จริง หรือค่าคอนฟิกของระบบภายนอก

## สิ่งที่ต้องเตรียม

- สิทธิ์ดูแล repository และการตั้งค่า deployment
- ค่า environment variables สำหรับเชื่อมต่อบริการ backend (ห้ามใส่ค่าจริงลงใน source code)
- branch หลักที่ใช้เผยแพร่ เช่น `<default-branch>`

## 1. ตั้งค่า path สำหรับ production build

กำหนด base path ให้ตรงกับชื่อ project ของเว็บไซต์ เพื่อให้ไฟล์ JavaScript, CSS และรูปภาพถูกอ้างอิงถูกตำแหน่งหลัง deploy

```ts
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/<project-path>/",
}));
```

หากเว็บไซต์อยู่ที่ root domain ให้ใช้ `"/"` แทน

## 2. ตั้งค่า environment variables ในระบบ CI/CD

ไปที่การตั้งค่า Secrets หรือ Variables ของ repository แล้วเพิ่มค่าที่ production build ต้องใช้ เช่น

```text
VITE_<SERVICE>_API_KEY
VITE_<SERVICE>_AUTH_DOMAIN
VITE_<SERVICE>_PROJECT_ID
VITE_<SERVICE>_STORAGE_BUCKET
VITE_<SERVICE>_SENDER_ID
VITE_<SERVICE>_APP_ID
```

จากนั้นส่งค่าดังกล่าวให้คำสั่ง build ใน workflow:

```yaml
- name: Build
  run: pnpm build
  env:
    VITE_<SERVICE>_API_KEY: ${{ secrets.VITE_<SERVICE>_API_KEY }}
    VITE_<SERVICE>_AUTH_DOMAIN: ${{ secrets.VITE_<SERVICE>_AUTH_DOMAIN }}
    VITE_<SERVICE>_PROJECT_ID: ${{ secrets.VITE_<SERVICE>_PROJECT_ID }}
    VITE_<SERVICE>_STORAGE_BUCKET: ${{ secrets.VITE_<SERVICE>_STORAGE_BUCKET }}
    VITE_<SERVICE>_SENDER_ID: ${{ secrets.VITE_<SERVICE>_SENDER_ID }}
    VITE_<SERVICE>_APP_ID: ${{ secrets.VITE_<SERVICE>_APP_ID }}
```

> ตัวแปรที่ขึ้นต้นด้วย `VITE_` จะถูกนำไปใช้ใน frontend bundle ได้ จึงไม่ควรเก็บ secret ที่ต้องปิดเป็นความลับไว้ในตัวแปรกลุ่มนี้

## 3. สร้าง workflow สำหรับ build และ deploy

workflow ควรทำงานเมื่อมีการ push เข้า branch หลัก และทำตามลำดับนี้:

1. checkout source code
2. ติดตั้ง Node.js และ pnpm
3. ติดตั้ง dependencies ด้วย `pnpm install --frozen-lockfile`
4. build ด้วย `pnpm build`
5. upload โฟลเดอร์ `dist`
6. deploy artifact ไปยัง static hosting

ตัวอย่างโครงสร้าง trigger:

```yaml
on:
  push:
    branches: [<default-branch>]
  workflow_dispatch:
```

ในหน้าตั้งค่า Pages/Deployment ให้เลือกใช้การ deploy จาก workflow นี้

## 4. อนุญาต domain ในบริการ Authentication

หากเว็บมีระบบ login ให้เพิ่ม hostname ของ production site เช่น `<site-hostname>` ในรายการ **Authorized domains** ของผู้ให้บริการ Authentication มิฉะนั้นการเข้าสู่ระบบบนเว็บไซต์จริงอาจถูกปฏิเสธ

## 5. จัดการ routing ของ Single-page Application

Static hosting ไม่มี server rewrite สำหรับ URL ย่อยโดยค่าเริ่มต้น ดังนั้นการ refresh หน้าที่มี path เช่น `/invoices/<id>` อาจได้หน้า 404

เลือกทำอย่างใดอย่างหนึ่ง:

- เปลี่ยนเป็น hash routing เช่น `/#/invoices/<id>`
- เพิ่ม `404.html` ที่ redirect กลับเข้าแอป
- เลือก hosting ที่รองรับ SPA rewrite

## 6. ตรวจสอบก่อนเผยแพร่

```bash
pnpm build
pnpm lint
```

หลัง workflow สำเร็จ ให้ตรวจสอบหน้าแรก, login, การเชื่อมต่อ backend และลอง refresh หน้าที่มี URL ย่อยอย่างน้อยหนึ่งหน้า

## 7. เผยแพร่

commit การเปลี่ยนแปลง แล้ว merge หรือ push เข้า `<default-branch>` ระบบ CI/CD จะ build และ deploy เว็บโดยอัตโนมัติ

เก็บ URL จริง, ชื่อ repository, ค่า environment variables และข้อมูลบัญชีไว้นอกเอกสารฉบับที่แชร์ต่อ
