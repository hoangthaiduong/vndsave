import { budgetFor, categorySpending, percentChange, safePercent, shiftMonth, totals } from './finance.js';

export function buildInsights({ transactions, categories, budgets, month }) {
  const current = totals(transactions, month);
  const previousMonth = shiftMonth(month, -1);
  const previous = totals(transactions, previousMonth);
  const insights = [];

  if (current.expense > 0 && previous.expense > 0) {
    const change = percentChange(current.expense, previous.expense);
    const direction = change > 0 ? 'tăng' : change < 0 ? 'giảm' : 'không thay đổi';
    insights.push({ type: change > 0 ? 'warning' : 'success', title: `Chi tiêu ${direction} ${Math.abs(change).toFixed(1)}%`, detail: `Tháng này ${current.expense.toLocaleString('vi-VN')} ₫, tháng trước ${previous.expense.toLocaleString('vi-VN')} ₫.` });
  } else if (current.expense > 0 && previous.expense === 0) {
    insights.push({ type: 'info', title: 'Chưa có dữ liệu chi tiêu tháng trước', detail: 'Chưa thể so sánh xu hướng giữa hai tháng.' });
  }

  const active = categories;
  const ranked = active.map((c) => ({ category: c, amount: categorySpending(transactions, c.id, month), previous: categorySpending(transactions, c.id, previousMonth) })).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  if (ranked[0]) {
    insights.push({ type: 'info', title: `${ranked[0].category.name} là khoản chi lớn nhất`, detail: `Bạn đã chi ${ranked[0].amount.toLocaleString('vi-VN')} ₫ cho danh mục này trong tháng.` });
    if (current.expense > 0) {
      const share = ranked[0].amount / current.expense * 100;
      insights.push({ type: share >= 50 ? 'warning' : 'info', title: `${ranked[0].category.name} chiếm ${share.toFixed(1)}% tổng chi tiêu`, detail: `Đây là tỷ trọng của danh mục lớn nhất trong tổng ${current.expense.toLocaleString('vi-VN')} ₫ chi tiêu tháng này.` });
    }
  }

  const increases = ranked.map((x) => ({ ...x, delta: x.amount - x.previous })).filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta);
  if (increases[0] && increases[0].previous > 0) insights.push({ type: 'warning', title: `${increases[0].category.name} tăng chi tiêu nhiều nhất`, detail: `Tăng ${increases[0].delta.toLocaleString('vi-VN')} ₫ so với tháng trước.` });

  const budgetRows = active.map((c) => {
    const limit = budgetFor(budgets, c.id, month);
    const spent = categorySpending(transactions, c.id, month);
    return { c, limit, spent, usage: limit > 0 ? spent / limit * 100 : null };
  }).filter((x) => x.limit > 0 && x.spent > 0);
  budgetRows.filter((x) => x.usage >= 100).forEach((x) => insights.push({ type: 'danger', title: `Đã vượt ngân sách ${x.c.name}`, detail: `Chi ${x.spent.toLocaleString('vi-VN')} ₫ trên ngân sách ${x.limit.toLocaleString('vi-VN')} ₫.` }));
  budgetRows.filter((x) => x.usage >= 80 && x.usage < 100).forEach((x) => insights.push({ type: 'warning', title: `Ngân sách ${x.c.name} gần đạt giới hạn`, detail: `Đã sử dụng ${x.usage.toFixed(0)}% ngân sách.` }));

  if (current.income > 0) {
    const spendRate = safePercent(current.expense, current.income);
    const savingsRate = safePercent(current.income - current.expense, current.income);
    insights.push({ type: spendRate > 100 ? 'danger' : 'info', title: `Tỷ lệ chi tiêu ${spendRate.toFixed(1)}%`, detail: `Tổng chi tiêu trên tổng thu nhập thực tế của tháng.` });
    insights.push({ type: savingsRate >= 20 ? 'success' : savingsRate >= 0 ? 'info' : 'warning', title: `Tỷ lệ tiết kiệm ${savingsRate.toFixed(1)}%`, detail: `Tính trên thu nhập thực tế ${current.income.toLocaleString('vi-VN')} ₫ và chi tiêu ${current.expense.toLocaleString('vi-VN')} ₫.` });
    insights.push({ type: current.income - current.expense >= 0 ? 'success' : 'warning', title: 'Số tiền còn lại sau chi tiêu', detail: `${(current.income - current.expense).toLocaleString('vi-VN')} ₫ là phần chênh lệch giữa thu nhập thực tế và chi tiêu trong tháng.` });
  } else if (current.expense > 0) {
    insights.push({ type: 'info', title: 'Chưa có giao dịch thu nhập', detail: 'Hãy thêm thu nhập thực tế để tính tỷ lệ chi tiêu và tiết kiệm.' });
  }
  const trendKeys = [shiftMonth(month, -2), shiftMonth(month, -1), month];
  const trendValues = trendKeys.map((key) => ({ key, expense: totals(transactions, key).expense }));
  if (trendValues.every((x) => x.expense > 0)) {
    const first = trendValues[0].expense;
    const last = trendValues[2].expense;
    const trendChange = percentChange(last, first);
    const direction = trendChange > 0 ? 'tăng' : trendChange < 0 ? 'giảm' : 'ổn định';
    insights.push({ type: trendChange > 0 ? 'warning' : 'info', title: `Xu hướng chi tiêu 3 tháng: ${direction}`, detail: `Tổng chi tiêu thay đổi ${Math.abs(trendChange).toFixed(1)}% từ ${first.toLocaleString('vi-VN')} ₫ lên ${last.toLocaleString('vi-VN')} ₫.` });
  }
  if (current.expense > 0) {
    const categoriesUsed = ranked.length;
    insights.push({ type: 'info', title: `Bạn đã chi tiêu ở ${categoriesUsed} danh mục`, detail: `Tổng cộng ${current.expense.toLocaleString('vi-VN')} ₫ được ghi nhận trong ${month}.` });
  }

  if (!insights.length) insights.push({ type: 'empty', title: 'Chưa đủ dữ liệu để phân tích', detail: 'Thêm giao dịch thu nhập hoặc chi tiêu để VND Save tạo nhận xét dựa trên tình hình thực tế.' });
  return insights;
}
