'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="container page empty"><h1>Koneksi sedang terganggu.</h1><p>Data belum berhasil dimuat. Silakan coba kembali.</p><button className="button" onClick={reset}>Coba lagi</button></div>;}
