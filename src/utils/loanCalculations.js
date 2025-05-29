// export class LoanCalculations {
//   static calculateEMI(principal, annualRate, termInMonths) {
//     const monthlyRate = annualRate / 100 / 12;

//     if (monthlyRate === 0) {
//       return principal / termInMonths;
//     }

//     const emi =
//       (principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths)) /
//       (Math.pow(1 + monthlyRate, termInMonths) - 1);

//     return Math.round(emi * 100) / 100;
//   }

//   static calculateTotalPayable(emi, termInMonths) {
//     return Math.round(emi * termInMonths * 100) / 100;
//   }

//   static calculateInterestAmount(totalPayable, principal) {
//     return Math.round((totalPayable - principal) * 100) / 100;
//   }

//   static generateAmortizationSchedule(principal, annualRate, termInMonths) {
//     const monthlyRate = annualRate / 100 / 12;
//     const emi = this.calculateEMI(principal, annualRate, termInMonths);
//     const schedule = [];
//     let remainingBalance = principal;

//     for (let month = 1; month <= termInMonths; month++) {
//       const interestPayment = remainingBalance * monthlyRate;
//       const principalPayment = emi - interestPayment;
//       remainingBalance -= principalPayment;

//       schedule.push({
//         month,
//         emi: Math.round(emi * 100) / 100,
//         principalPayment: Math.round(principalPayment * 100) / 100,
//         interestPayment: Math.round(interestPayment * 100) / 100,
//         remainingBalance: Math.max(0, Math.round(remainingBalance * 100) / 100),
//       });
//     }

//     return schedule;
//   }
// }
