type HandName = "hour" | "minute" | "second";

const handElements: Record<HandName, HTMLElement> = {
  hour: document.querySelector("[data-hand='hour']") as HTMLElement,
  minute: document.querySelector("[data-hand='minute']") as HTMLElement,
  second: document.querySelector("[data-hand='second']") as HTMLElement,
};

function rotationFromTime(date: Date) {
  const milliseconds = date.getMilliseconds();
  const seconds = date.getSeconds() + milliseconds / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  return {
    hour: hours * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}

function setHandAngle(hand: HTMLElement, degrees: number) {
  hand.style.transform = `rotate(${degrees}deg)`;
}

function render() {
  const now = new Date();
  const rotation = rotationFromTime(now);

  setHandAngle(handElements.hour, rotation.hour);
  setHandAngle(handElements.minute, rotation.minute);
  setHandAngle(handElements.second, rotation.second);

  requestAnimationFrame(render);
}

render();
