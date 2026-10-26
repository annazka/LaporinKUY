import {redirect} from 'next/navigation';
import {viewer} from '@/lib/backend';
import {OperatorLogin} from '@/components/operator-login';
export const metadata={title:'Masuk operator',robots:{index:false,follow:false}};
export default async function OperatorSignIn(){const user=await viewer();if(user?.role==='operator')redirect('/operator');return <OperatorLogin signedIn={Boolean(user)}/>;}
