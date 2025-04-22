async function redirect(direction) {
  if(direction === 'logout'){
    window.location.href = '/logout';
  } else if (direction === 'profile'){
    window.location.href = '/profile';
  } else if (direction === 'change-pass'){
    window.location.href = '/change-password';
  } else {
    console.error("Invalid Redirection!");
  }
}

