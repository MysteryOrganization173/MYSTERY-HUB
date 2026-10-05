// Informational MTN package examples. These are not products sold by Mystery Hub.
export const AFA_PACKAGES = [
  {name:'Monthly without data',price:10,onNet:250,offNet:30,cug:500,sms:255,data:null,days:30},
  {name:'Monthly with data',price:10,onNet:180,offNet:30,cug:500,sms:255,data:'250 MB',days:30},
  {name:'Weekly without data',price:3,onNet:60,offNet:7,cug:200,sms:10,data:null,days:7},
  {name:'Weekly with data',price:3,onNet:45,offNet:7,cug:200,sms:10,data:'100 MB',days:7},
] as const;
