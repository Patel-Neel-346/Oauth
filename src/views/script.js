//  <script>
{
  /* // Banking Transaction System - Cleaned and Fixed Version */
}
{
  /* // Configuration */
}
const API_BASE_URL = "http://localhost:7000";
const STRIPE_PUBLIC_KEY =
  "pk_test_51QfQyYCQkunRa8JYtiDumB6BMWjOwqrYMnp3p14rxHepDcSWALJKrKGp4immlWPAbejkuzGgoJbsIApu8WEbgv0Z00NwDBA5XT";

// Global variables
let stripe;
let elements;
let paymentElement;
let paymentIntentClientSecret;
let transactions = [];
let authToken = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  initializeStripe();
  loadTransactions();
  setupEventListeners();
  checkAuthToken();
});

// Check for authentication token
function checkAuthToken() {
  // Get token from your auth system - adjust as needed
  authToken = "demo-token"; // Replace with actual token logic

  if (!authToken) {
    showAlert("Please log in to access banking services.", "error");
  }
}

// Initialize Stripe
async function initializeStripe() {
  try {
    if (typeof Stripe === "undefined") {
      console.warn("Stripe.js not loaded. Card payments will be unavailable.");
      return;
    }
    stripe = Stripe(STRIPE_PUBLIC_KEY);
    console.log("Stripe initialized successfully");
  } catch (error) {
    console.error("Stripe initialization failed:", error);
    showAlert(
      "Stripe initialization failed. Card payments unavailable.",
      "error"
    );
  }
}

// Setup event listeners
function setupEventListeners() {
  // Format account number inputs
  const accountInputs = document.querySelectorAll('input[id*="AccountNumber"]');
  accountInputs.forEach((input) => {
    input.addEventListener("input", function (e) {
      e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    });
  });

  // Format amount inputs
  const amountInputs = document.querySelectorAll('input[type="number"]');
  amountInputs.forEach((input) => {
    input.addEventListener("blur", function (e) {
      if (e.target.value) {
        const value = parseFloat(e.target.value);
        if (!isNaN(value)) {
          e.target.value = value.toFixed(2);
        }
      }
    });
  });

  // Format phone input
  const phoneInput = document.getElementById("cardholderPhone");
  if (phoneInput) {
    phoneInput.addEventListener("input", function (e) {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length >= 10) {
        value = value.slice(0, 10);
        e.target.value = `(${value.slice(0, 3)}) ${value.slice(
          3,
          6
        )}-${value.slice(6)}`;
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key >= "1" && e.key <= "4") {
      e.preventDefault();
      const tabs = ["deposit", "withdraw", "transfer", "history"];
      const tabIndex = parseInt(e.key) - 1;
      if (tabs[tabIndex]) {
        showTab(tabs[tabIndex]);
      }
    }
    if (e.key === "Escape") {
      closeStripeModal();
    }
  });
}

// Utility functions
function showAlert(message, type = "success") {
  const alertsContainer = document.getElementById("alerts");
  if (!alertsContainer) return;

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} show`;
  alertDiv.innerHTML = `
    <i class="fas fa-${
      type === "success" ? "check-circle" : "exclamation-triangle"
    }"></i>
    ${message}
    <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; cursor: pointer; font-size: 1.2rem;">&times;</button>
  `;
  alertsContainer.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 5000);
}

function setLoading(buttonId, spinnerId, isLoading) {
  const button = document.getElementById(buttonId);
  const spinner = document.getElementById(spinnerId);

  if (button) button.disabled = isLoading;
  if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function getCurrentDateTime() {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// API call function
async function makeAPICall(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    console.log(data);
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

// Tab functionality
function showTab(id) {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => tab.classList.remove("active"));
  contents.forEach((content) => content.classList.remove("active"));

  document.getElementById(id)?.classList.add("active");
  document
    .querySelector(`[onclick="showTab('${id}')"]`)
    ?.classList.add("active");
}

function toggleDepositMethod() {
  const method = document.getElementById("depositMethod")?.value;
  const cashDeposit = document.getElementById("cashDeposit");
  const stripeDeposit = document.getElementById("stripeDeposit");

  if (cashDeposit && stripeDeposit) {
    cashDeposit.style.display = method === "cash" ? "block" : "none";
    stripeDeposit.style.display = method === "stripe" ? "block" : "none";
  }
}

// Transaction management
function addTransaction(
  type,
  amount,
  description,
  accountNumber,
  toAccount = null
) {
  const transaction = {
    id: "txn_" + Math.random().toString(36).substr(2, 9),
    type,
    amount: parseFloat(amount),
    description,
    accountNumber,
    toAccount,
    timestamp: getCurrentDateTime(),
    status: "completed",
  };

  transactions.unshift(transaction);
  updateTransactionHistory();
  return transaction;
}

function updateTransactionHistory() {
  const transactionList = document.getElementById("transactionList");
  if (!transactionList) return;

  transactionList.innerHTML = "";

  if (transactions.length === 0) {
    transactionList.innerHTML =
      '<p class="text-center text-muted">No transactions found.</p>';
    return;
  }

  transactions.forEach((transaction) => {
    const transactionItem = document.createElement("div");
    transactionItem.className = "transaction-item";

    const typeClass = "type-" + transaction.type;
    const typeDisplay =
      transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);
    let details = transaction.description;

    if (transaction.type === "transfer") {
      details += ` (From: ${transaction.accountNumber} To: ${transaction.toAccount})`;
    } else {
      details += ` (Account: ${transaction.accountNumber})`;
    }

    transactionItem.innerHTML = `
      <div>
        <strong>${typeDisplay}</strong> - ${formatCurrency(transaction.amount)}
        <br />
        <small class="text-muted">${transaction.timestamp}</small>
        <br />
        <span class="text-secondary">${details}</span>
      </div>
      <span class="transaction-type ${typeClass}">${typeDisplay}</span>
    `;

    transactionList.appendChild(transactionItem);
  });
}

async function loadTransactions() {
  try {
    const response = await makeAPICall("/api/transaction/getUserAccount");
    if (response.success && response.data.transactions) {
      const apiTransactions = response.data.transactions.map((tx) => ({
        id: tx._id || tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        accountNumber:
          tx.toAccount?.accountNumber || tx.fromAccount?.accountNumber || "N/A",
        toAccount: tx.toAccount?.accountNumber,
        timestamp: new Date(tx.createdAt || tx.timestamp).toLocaleString(),
        status: tx.status,
      }));
      transactions = apiTransactions;
    } else {
      loadSampleTransactions();
    }
  } catch (error) {
    console.error("Failed to load transactions:", error);
    loadSampleTransactions();
  }
  updateTransactionHistory();
}

function loadSampleTransactions() {
  transactions = [
    {
      id: "txn_sample1",
      type: "deposit",
      amount: 500.0,
      description: "Stripe payment deposit",
      accountNumber: "12345678",
      timestamp: "2024-01-15 10:30 AM",
      status: "completed",
    },
    {
      id: "txn_sample2",
      type: "withdrawal",
      amount: 100.0,
      description: "ATM withdrawal",
      accountNumber: "12345678",
      timestamp: "2024-01-14 02:15 PM",
      status: "completed",
    },
    {
      id: "txn_sample3",
      type: "transfer",
      amount: 250.0,
      description: "Transfer to savings account",
      accountNumber: "12345678",
      toAccount: "87654321",
      timestamp: "2024-01-13 09:45 AM",
      status: "completed",
    },
  ];
}

// Validation functions
function validateAccountNumber(accountNumber) {
  const accountRegex = /^[a-zA-Z0-9]{8,12}$/;
  return accountRegex.test(accountNumber);
}

function validateDepositForm() {
  const accountNumber = document.getElementById("depositAccountNumber")?.value;
  const amount = parseFloat(document.getElementById("depositAmount")?.value);

  if (!validateAccountNumber(accountNumber)) {
    showAlert("Account number must be 8-12 alphanumeric characters.", "error");
    return false;
  }

  if (!amount || amount <= 0 || amount > 50000) {
    showAlert("Amount must be between $0.01 and $50,000.", "error");
    return false;
  }

  return true;
}

function validateWithdrawForm() {
  const accountNumber = document.getElementById("withdrawAccountNumber")?.value;
  const amount = parseFloat(document.getElementById("withdrawAmount")?.value);

  if (!validateAccountNumber(accountNumber)) {
    showAlert("Account number must be 8-12 alphanumeric characters.", "error");
    return false;
  }

  if (!amount || amount <= 0 || amount > 10000) {
    showAlert("Withdrawal amount must be between $0.01 and $10,000.", "error");
    return false;
  }

  return true;
}

function validateTransferForm() {
  const fromAccount = document.getElementById("fromAccountNumber")?.value;
  const toAccount = document.getElementById("toAccountNumber")?.value;
  const amount = parseFloat(document.getElementById("transferAmount")?.value);

  if (
    !validateAccountNumber(fromAccount) ||
    !validateAccountNumber(toAccount)
  ) {
    showAlert(
      "Both account numbers must be 8-12 alphanumeric characters.",
      "error"
    );
    return false;
  }

  if (fromAccount === toAccount) {
    showAlert("Source and destination accounts cannot be the same.", "error");
    return false;
  }

  if (!amount || amount <= 0 || amount > 25000) {
    showAlert("Transfer amount must be between $0.01 and $25,000.", "error");
    return false;
  }

  return true;
}

// Transaction processing functions
async function processCashDeposit() {
  if (!validateDepositForm()) return;

  const accountNumber = document.getElementById("depositAccountNumber").value;
  const amount = parseFloat(document.getElementById("depositAmount").value);
  const description =
    document.getElementById("depositDescription").value || "Cash deposit";

  setLoading("cashDepositBtn", "cashSpinner", true);

  try {
    const response = await makeAPICall("/api/transaction/deposit", {
      method: "POST",
      body: JSON.stringify({
        accountNumber,
        amount,
        description,
      }),
    });

    if (response.success) {
      addTransaction("deposit", amount, description, accountNumber);
      showAlert(
        `Cash deposit of ${formatCurrency(amount)} processed successfully!`,
        "success"
      );
      document.getElementById("depositForm")?.reset();
      await loadTransactions();
    } else {
      showAlert(
        response.message || "Cash deposit failed. Please try again.",
        "error"
      );
    }
  } catch (error) {
    console.error("Cash deposit error:", error);
    showAlert(
      error.message || "An error occurred while processing the deposit.",
      "error"
    );
  } finally {
    setLoading("cashDepositBtn", "cashSpinner", false);
  }
}

async function processWithdraw() {
  if (!validateWithdrawForm()) return;

  const accountNumber = document.getElementById("withdrawAccountNumber").value;
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  const description =
    document.getElementById("withdrawDescription").value || "Cash withdrawal";

  setLoading("withdrawBtn", "withdrawSpinner", true);

  try {
    const response = await makeAPICall("/api/transaction/withdraw", {
      method: "POST",
      body: JSON.stringify({
        accountNumber,
        amount,
        description,
      }),
    });

    if (response.success) {
      addTransaction("withdrawal", amount, description, accountNumber);
      showAlert(
        `Withdrawal of ${formatCurrency(amount)} processed successfully!`,
        "success"
      );
      document.getElementById("withdrawForm")?.reset();
      await loadTransactions();
    } else {
      showAlert(
        response.message ||
          "Withdrawal failed. Please check account balance and try again.",
        "error"
      );
    }
  } catch (error) {
    console.error("Withdrawal error:", error);
    showAlert(
      error.message || "An error occurred while processing the withdrawal.",
      "error"
    );
  } finally {
    setLoading("withdrawBtn", "withdrawSpinner", false);
  }
}

async function processTransfer() {
  if (!validateTransferForm()) return;

  const fromAccount = document.getElementById("fromAccountNumber").value;
  const toAccount = document.getElementById("toAccountNumber").value;
  const amount = parseFloat(document.getElementById("transferAmount").value);
  const description =
    document.getElementById("transferDescription").value || "Account transfer";

  setLoading("transferBtn", "transferSpinner", true);

  try {
    const response = await makeAPICall("/api/transaction/transfer", {
      method: "POST",
      body: JSON.stringify({
        fromAccount,
        toAccount,
        amount,
        description,
      }),
    });

    if (response.success) {
      addTransaction("transfer", amount, description, fromAccount, toAccount);
      showAlert(
        `Transfer of ${formatCurrency(amount)} processed successfully!`,
        "success"
      );
      document.getElementById("transferForm")?.reset();
      await loadTransactions();
    } else {
      showAlert(
        response.message ||
          "Transfer failed. Please check account details and balance.",
        "error"
      );
    }
  } catch (error) {
    console.error("Transfer error:", error);
    showAlert(
      error.message || "An error occurred while processing the transfer.",
      "error"
    );
  } finally {
    setLoading("transferBtn", "transferSpinner", false);
  }
}

// Stripe payment functions - FIXED VERSION
function showStripeModal() {
  if (!stripe) {
    showAlert(
      "Stripe not available. Please refresh the page or use cash deposit.",
      "error"
    );
    return;
  }

  const accountNumber = document.getElementById("depositAccountNumber")?.value;
  const amount = parseFloat(document.getElementById("depositAmount")?.value);
  const description =
    document.getElementById("depositDescription")?.value || "Card deposit";
  const cardholderName = document.getElementById("cardholderName")?.value;
  const cardholderEmail = document.getElementById("cardholderEmail")?.value;
  const cardholderPhone = document.getElementById("cardholderPhone")?.value;

  // Validation
  if (
    !accountNumber ||
    !amount ||
    amount <= 0 ||
    !cardholderName ||
    !cardholderEmail
  ) {
    showAlert(
      "Please fill in all required fields before proceeding with payment.",
      "error"
    );
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cardholderEmail)) {
    showAlert("Please enter a valid email address.", "error");
    return;
  }

  // Update payment summary
  document.getElementById("summaryAccount").textContent = accountNumber;
  document.getElementById("summaryDescription").textContent = description;
  document.getElementById("summaryAmount").textContent = formatCurrency(amount);

  // Show modal
  const modal = document.getElementById("stripeModal");
  if (modal) {
    modal.style.display = "flex";
    initializeStripePayment(
      amount,
      cardholderEmail,
      cardholderName,
      cardholderPhone
    );
  }
}

function closeStripeModal() {
  const modal = document.getElementById("stripeModal");
  if (modal) {
    modal.style.display = "none";
  }

  // Clean up Stripe elements
  if (elements) {
    elements = null;
    paymentElement = null;
  }

  // Clear any error messages
  const messageElement = document.getElementById("stripe-payment-message");
  if (messageElement) {
    messageElement.style.display = "none";
    messageElement.textContent = "";
  }
}

async function initializeStripePayment(amount, email, name, phone) {
  if (!stripe) {
    showAlert("Stripe not initialized. Please refresh the page.", "error");
    return;
  }

  try {
    const accountNumber = document.getElementById("depositAccountNumber").value;
    const description =
      document.getElementById("depositDescription").value || "Card deposit";

    // FIXED: Use consistent API endpoint
    const response = await makeAPICall(
      "/api/transaction/stripe/create-payment-intent",
      {
        method: "POST",
        body: JSON.stringify({
          accountNumber,
          amount,
          description,
          customerData: {
            name,
            email,
            phone: phone || null,
          },
          currency: "usd",
        }),
      }
    );

    if (!response.success) {
      throw new Error(response.message || "Failed to create payment intent");
    }

    // FIXED: Handle different response structures
    paymentIntentClientSecret =
      response.data?.paymentIntent?.client_secret ||
      response.paymentIntent?.client_secret ||
      response.client_secret;

    if (!paymentIntentClientSecret) {
      throw new Error("Payment intent client secret not found in response");
    }

    // Initialize Stripe Elements
    elements = stripe.elements({
      clientSecret: paymentIntentClientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#007bff",
          colorBackground: "#ffffff",
          colorText: "#333333",
          colorDanger: "#dc3545",
          fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
          spacingUnit: "4px",
          borderRadius: "8px",
        },
      },
    });

    // Create and mount payment element
    paymentElement = elements.create("payment");
    paymentElement.mount("#stripe-payment-element");

    // Handle payment element events
    paymentElement.on("ready", () => {
      console.log("Payment Element ready");
    });

    paymentElement.on("change", (event) => {
      const messageElement = document.getElementById("stripe-payment-message");
      if (messageElement) {
        if (event.error) {
          messageElement.textContent = event.error.message;
          messageElement.style.display = "block";
        } else {
          messageElement.style.display = "none";
        }
      }
    });
  } catch (error) {
    console.error("Stripe initialization error:", error);
    showAlert(
      error.message || "Failed to initialize payment. Please try again.",
      "error"
    );
    closeStripeModal();
  }
}

async function handleStripePayment() {
  if (!stripe || !elements || !paymentIntentClientSecret) {
    showAlert(
      "Payment not properly initialized. Please close and try again.",
      "error"
    );
    return;
  }

  const submitButton = document.getElementById("stripe-submit-button");
  const spinner = document.getElementById("stripeModalSpinner");
  const messageElement = document.getElementById("stripe-payment-message");

  // Show loading state
  if (submitButton) submitButton.disabled = true;
  if (spinner) spinner.style.display = "inline-block";
  if (messageElement) messageElement.style.display = "none";

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      if (messageElement) {
        messageElement.textContent = error.message;
        messageElement.style.display = "block";
      }
      console.error("Payment error:", error);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      // Payment succeeded, process the deposit
      const accountNumber = document.getElementById(
        "depositAccountNumber"
      ).value;
      const amount = parseFloat(document.getElementById("depositAmount").value);
      const description =
        document.getElementById("depositDescription").value || "Card deposit";

      try {
        // FIXED: Use consistent API endpoint
        const response = await makeAPICall(
          "/api/transaction/stripe/confirm-payment",
          {
            method: "POST",
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              accountNumber,
              amount,
              description,
            }),
          }
        );

        if (response.success) {
          addTransaction(
            "deposit",
            amount,
            `${description} (Stripe Payment)`,
            accountNumber
          );
          showAlert(
            `Card deposit of ${formatCurrency(amount)} processed successfully!`,
            "success"
          );
          document.getElementById("depositForm")?.reset();
          await loadTransactions();
          closeStripeModal();
        } else {
          showAlert(
            response.message ||
              "Payment succeeded but deposit processing failed.",
            "error"
          );
        }
      } catch (confirmError) {
        console.error("Payment confirmation error:", confirmError);
        showAlert(
          "Payment succeeded but there was an error updating your account. Please contact support.",
          "error"
        );
      }
    }
  } catch (error) {
    console.error("Payment confirmation error:", error);
    if (messageElement) {
      messageElement.textContent =
        "An unexpected error occurred. Please try again.";
      messageElement.style.display = "block";
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
    if (spinner) spinner.style.display = "none";
  }
}

// Export/Import functionality - SIMPLIFIED
function exportTransactions() {
  try {
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "transactions_" + new Date().toISOString().split("T")[0] + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert("Transaction history exported successfully.", "success");
  } catch (error) {
    console.error("Export error:", error);
    showAlert("Failed to export transaction history.", "error");
  }
}

function clearTransactionHistory() {
  if (
    confirm(
      "Are you sure you want to clear all transaction history? This action cannot be undone."
    )
  ) {
    transactions = [];
    updateTransactionHistory();
    showAlert("Transaction history cleared.", "info");
  }
}

// Make functions globally available
window.showTab = showTab;
window.toggleDepositMethod = toggleDepositMethod;
window.processCashDeposit = processCashDeposit;
window.processWithdraw = processWithdraw;
window.processTransfer = processTransfer;
window.showStripeModal = showStripeModal;
window.closeStripeModal = closeStripeModal;
window.handleStripePayment = handleStripePayment;
window.exportTransactions = exportTransactions;
window.clearTransactionHistory = clearTransactionHistory;

// </script>
