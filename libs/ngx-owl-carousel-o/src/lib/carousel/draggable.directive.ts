import { Directive, NgZone, ElementRef, HostListener, Renderer2, OnInit, OnDestroy } from '@angular/core';
import { CarouselService, Coords } from '../services/carousel.service';
import { Subject, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

@Directive({
  selector: '[owlDraggable]'
})
export class DraggableDirective implements OnInit, OnDestroy{
  /**
   * Function wich will be returned after attaching listener to 'mousemove' event
   */
  listenerMouseMove: () => void;
  /**
   * Function wich will be returned after attaching listener to 'touchmove' event
   */
  listenerTouchMove: () => void;
  /**
   * Function wich will be returned after attaching listener to 'mousemove' event
   */
  listenerOneMouseMove: () => void;
  /**
   * Function wich will be returned after attaching listener to 'touchmove' event
   */
  listenerOneTouchMove: () => void;

  /**
   * Function wich will be returned after attaching listener to 'mouseup' event
   */
  listenerMouseUp: () => void;
  /**
   * Function wich will be returned after attaching listener to 'touchend' event
   */
  listenerTouchEnd: () => void;

  /**
   * Function wich will be returned after attaching listener to 'click' event
   */
  listenerOneClick: () => void;

  /**
   * Object with data needed for dragging
   */
  private _drag: any = {
    time: null,
    target: null,
    pointer: null,
    stage: {
      start: null,
      current: null
    },
    direction: null,
    active: false,
    moving: false
  };

  /**
   * Subject for notification when the carousel's rebuilding caused by resize event starts
   */
  private _oneDragMove$ = new Subject<any>();

  /**
   * Subsctiption to _oneDragMove$ Subject
   */
  private _oneMoveSubsription: Subscription;

  constructor(private zone: NgZone,
              private el: ElementRef,
              private renderer: Renderer2,
              private carouselService: CarouselService) { }

  @HostListener('mousedown', ['$event']) onMouseDown(event) {
    this._onDragStart(event);
    return false;
  }

  @HostListener('mouseup', ['$event']) onMouseUp(event) {
    return false;
  }

  @HostListener('touchstart', ['$event']) onTouchStart(event) {
    this._onDragStart(event);
    return false;
  }

  @HostListener('touchcancel', ['$event']) onTouchCancel(event) {
    return false;
  }

  @HostListener('touchend', ['$event']) onTouchEnd(event) {
    return false;
  }

  @HostListener('dragstart') onDragStart() {
    return false;
  }

  @HostListener('selectstart') onSelectStart() {
    return false;
  }

  ngOnInit() {
    this._oneMoveSubsription = this._oneDragMove$
      .pipe(first())
      .subscribe(() => {
        this._sendChanges();
      });
  }

  ngOnDestroy() {
    this._oneMoveSubsription.unsubscribe();
  }

  /**
   * Passes this to _oneMouseTouchMove();
   */
  bindOneMouseTouchMove = (ev) => {
    this._oneMouseTouchMove(ev);
  }

  /**
   * Passes this to _onDragMove();
   */
  bindOnDragMove = (ev) => {
    this._onDragMove(ev);
  }

  /**
   * Passes this to _onDragMove();
   */
  bindOnDragEnd = (ev) => {
    // this.zone.run(() => {
      this._onDragEnd(ev);
    // });
  }

  /**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @param event - The event arguments.
	 */
	private _onDragStart(event): any {
		let stage: Coords = null;

		if (event.which === 3) {
			return;
    }

    stage = this._prepareDragging(event);

		this._drag.time = new Date().getTime();
		this._drag.target = event.target;
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
    this._drag.pointer = this._pointer(event);
    this._drag.active = true;

    this.listenerMouseUp = this.renderer.listen(document, 'mouseup', this.bindOnDragEnd);
    this.listenerTouchEnd = this.renderer.listen(document, 'touchend', this.bindOnDragEnd);

    this.zone.runOutsideAngular(() => {
      this.listenerOneMouseMove = this.renderer.listen(document, 'mousemove', this.bindOneMouseTouchMove);
      this.listenerOneTouchMove = this.renderer.listen(document, 'touchmove', this.bindOneMouseTouchMove);
    });

  }

  /**
   * Attaches listeners to `touchmove` and `mousemove` events; initiates updating carousel after starting dragging
   * @param event event objech of mouse or touch event
   */
  private _oneMouseTouchMove(event) {
    if (!this._drag.active) return false;
    const delta = this._difference(this._drag.pointer, this._pointer(event));

    this._drag.moving = true;

    this.listenerOneMouseMove();
    this.listenerOneTouchMove();

    if (Math.abs(delta.x) < Math.abs(delta.y) && this._is('valid')) {
      this._drag.active = false;
      return;
    }
    this.listenerMouseMove = this.renderer.listen(document, 'mousemove', this.bindOnDragMove);
    this.listenerTouchMove = this.renderer.listen(document, 'touchmove', this.bindOnDragMove);

    event.preventDefault();

    this._enter('dragging');
    // this.carouselService._trigger('drag');
    this._oneDragMove$.next(event);
    // this._sendChanges();
  }

  	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @param event - The event arguments.
	 */
	private _onDragMove(event) {
    if (!this._drag.active) return false;

    let stage: Coords;
    const stageOrExit: boolean | Coords = this.carouselService.defineNewCoordsDrag(event, this._drag);

    if (stageOrExit === false) {
      return;
    }
    stage = stageOrExit as Coords;

		event.preventDefault();

    this._drag.stage.current = stage;
		this._animate(stage.x - this._drag.stage.start.x);
  };

  /**
   * Moves .owl-stage left-right
   * @param coordinate coordinate to be set to .owl-stage
   */
  private _animate(coordinate: number) {
    this.renderer.setStyle(this.renderer.parentNode(this.el.nativeElement), 'transform', `translate3d(${coordinate}px,0px,0px`);
    this.renderer.setStyle(this.renderer.parentNode(this.el.nativeElement), 'transition', '0s');
  }

  /**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @param event - The event arguments.
	 */
	private _onDragEnd(event) {
    this.carouselService.owlDOMData.isGrab = false;

    if (this._drag.moving) {
      this.renderer.setStyle(this.renderer.parentNode(this.el.nativeElement), 'transform', ``);
      this.renderer.setStyle(this.renderer.parentNode(this.el.nativeElement), 'transition', this.carouselService.speed(+this.carouselService.settings.dragEndSpeed || this.carouselService.settings.smartSpeed)/1000 +'s');

      this._finishDragging(event);
      this.listenerMouseMove();
    }

    this._drag = {
      time: null,
      target: null,
      pointer: null,
      stage: {
        start: null,
        current: null
      },
      direction: null,
      active: false,
      moving: false
    };

    // this.carouselService.trigger('dragged');
    this.listenerMouseUp();
    this.listenerTouchEnd();
  };

  /**
	 * Prepares data for dragging carousel. It starts after firing `touchstart` and `mousedown` events.
	 * @param event - The event arguments.
	 * @returns stage - object with 'x' and 'y' coordinates of .owl-stage
	 */
  private _prepareDragging(event: any): Coords {
    return this.carouselService.prepareDragging(event);
  }

  /**
   * Attaches handler for 'click' event on any element in .owl-stage in order to prevent dragging when moving of cursor is less than 3px
   */
  private _oneClickHandler = () => {
    this.listenerOneClick = this.renderer.listen(this._drag.target, 'click', () => false)
    this.listenerOneClick();
  }

  /**
   * Finishes dragging
   * @param event object event of 'mouseUp' of 'touchend' events
   */
  private _finishDragging(event: any) {
    this.carouselService.finishDragging(event, this._drag, this._oneClickHandler);
  }

  /**
	 * Gets unified pointer coordinates from event.
	 * @param event - The `mousedown` or `touchstart` event.
	 * @returns - Contains `x` and `y` coordinates of current pointer position.
	 */
  private _pointer(event: any): any {
    return this.carouselService.pointer(event);
  }

  /**
	 * Gets the difference of two vectors.
	 * @param first - The first vector.
	 * @param second- The second vector.
	 * @returns - The difference.
	 */
  private _difference(firstC: Coords, second: Coords): any {
    return this.carouselService.difference(firstC, second);
  }

  /**
	 * Checks whether the carousel is in a specific state or not.
	 * @param state - The state to check.
	 * @return} - The flag which indicates if the carousel is busy.
	 */
  private _is(state: string): boolean {
    return this.carouselService.is(state);
  }

  /**
  * Enters a state.
  * @param name - The state name.
  */
  private _enter(name: string) {
    this.carouselService.enter(name);
  }

  /**
	 * Sends all data needed for View.
	 */
  private _sendChanges() {
    this.carouselService.sendChanges();
  }
}
