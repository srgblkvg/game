export interface DonatePremiumTransaction {
  lockPayment(paymentId:string):Promise<{paymentId:string;userId:number;item:string;amount:string;status:string}|null>;
  lockUser(userId:number):Promise<{id:number;premiumUntil:number|null}|null>;
  savePremium(userId:number,premiumUntil:number):Promise<void>;
  markSucceeded(paymentId:string,processedAt:number):Promise<void>;
}
export interface DonatePremiumRepository { transaction<T>(callback:(tx:DonatePremiumTransaction)=>Promise<T>):Promise<T>; }
interface Input {paymentId:string;providerUserId:string;providerItem:string;verifiedAmount:string;verifiedCurrency:string;processedAt:number;}
type Result={status:'delivered';userId:number;item:string;premiumUntil:number}|{status:'already-processed'}|{status:'rejected';reason:string};
const SKUS:Record<string,{amount:string;days:number}>={premium_7d:{amount:'99.00',days:7},premium_30d:{amount:'299.00',days:30}};
const money=(value:string)=>{const n=Number(value);return Number.isFinite(n)?n.toFixed(2):null};
export function processYooKassaPremiumPayment(repository:DonatePremiumRepository,input:Input):Promise<Result>{return repository.transaction(async tx=>{const payment=await tx.lockPayment(input.paymentId);if(!payment)return{status:'rejected',reason:'payment-not-found'};if(payment.status!=='pending')return{status:'already-processed'};const sku=SKUS[payment.item];if(!sku||payment.item!==input.providerItem||String(payment.userId)!==input.providerUserId||money(payment.amount)!==sku.amount||money(input.verifiedAmount)!==sku.amount||input.verifiedCurrency!=='RUB'||!Number.isInteger(input.processedAt)||input.processedAt<=0)return{status:'rejected',reason:'payment-mismatch'};const user=await tx.lockUser(payment.userId);if(!user)return{status:'rejected',reason:'user-not-found'};const current=Number(user.premiumUntil??0);if(!Number.isFinite(current)||current<0)return{status:'rejected',reason:'invalid-premium'};const premiumUntil=Math.max(current,input.processedAt)+sku.days*86400;await tx.savePremium(user.id,premiumUntil);await tx.markSucceeded(payment.paymentId,input.processedAt);return{status:'delivered',userId:user.id,item:payment.item,premiumUntil};});}
