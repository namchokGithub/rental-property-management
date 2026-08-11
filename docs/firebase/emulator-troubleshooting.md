# Firebase Emulator Troubleshooting (macOS)

คู่มือนี้ใช้สำหรับรัน Firestore และ Authentication Emulator ของโปรเจกต์นี้ในเครื่อง local (ไม่มี Cloud Functions Emulator แล้ว เพราะแอปนี้ไม่มี backend — ดู [setup.md](setup.md))

## รัน Emulator

จาก root ของโปรเจกต์:

```sh
firebase emulators:start --only auth,firestore
```

คำสั่งนี้จะเริ่ม Firestore Emulator ที่ port `8080`, Authentication Emulator ที่ port `9099` และ Emulator UI ที่ port `4001` (ตามที่กำหนดไว้ใน `firebase.json`).

## Error: Java Runtime ไม่พบ

หากพบข้อความนี้:

```text
Error: Process `java -version` has exited with code 1.
Please make sure Java is installed and on your system PATH.
```

Firestore Emulator ต้องใช้ Java Runtime ให้ติดตั้ง OpenJDK 21 ผ่าน Homebrew:

```sh
brew install openjdk@21
```

### Apple Silicon Mac (M1/M2/M3/M4)

เพิ่ม Java ไปยัง `PATH` ของ zsh:

```sh
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
echo 'export CPPFLAGS="-I/opt/homebrew/opt/openjdk@21/include"' >> ~/.zshrc
source ~/.zshrc
```

### Intel Mac

ใช้ path `/usr/local` แทน `/opt/homebrew`:

```sh
echo 'export PATH="/usr/local/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
echo 'export CPPFLAGS="-I/usr/local/opt/openjdk@21/include"' >> ~/.zshrc
source ~/.zshrc
```

ตรวจสอบว่า Java พร้อมใช้งาน:

```sh
java -version
```

จากนั้นเปิด Terminal ใหม่ หรือใช้ `source ~/.zshrc` แล้วรัน Emulator อีกครั้ง.

## Warning: ยังไม่ได้ Firebase login

ข้อความนี้เป็น warning:

```text
emulators: You are not currently authenticated so some features may not work correctly.
```

สำหรับการพัฒนา local เท่านั้น สามารถใช้ demo project ได้โดยไม่ต้อง login:

```sh
firebase emulators:start --only auth,firestore --project demo-rental-property-management
```

หากต้องการใช้ Firebase project จริง หรือ deploy ในภายหลัง ให้ login ผ่าน Firebase CLI:

```sh
firebase login
```

Browser จะเปิดเพื่อให้ login ด้วย Google account ที่มีสิทธิ์ใน Firebase project.

## หากยังรันไม่ได้

ตรวจสอบตามลำดับ:

```sh
node --version
java -version
pnpm build
pnpm lint
```

หาก port `8080`, `9099` หรือ `4001` ถูกใช้งานอยู่ ให้ปิด process เดิมก่อน หรือปรับ port ใน `firebase.json`.
