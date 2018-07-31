import { Injectable } from '@angular/core';
import { NavData, DotsData } from '../models/navigation-data.models';
import { CarouselSlideDirective } from '../carousel/carousel.module';
import { CarouselService } from './carousel.service';
import { Subscription, Observable, merge } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  /**
   * subscrioption to merge Observable  from CarouselService
   */
  navSubscription: Subscription;

  /**
   * Indicates whether the plugin is initialized or not.
   */
  protected _initialized = false;

  /**
   * The current paging indexes.
   */
  protected _pages: any[] = [];

  /**
   * Navigation elements of the user interface.
   */
  protected _navData: NavData = {
    disabled: false,
    prev: {
      disabled: false,
      htmlText: ''
    },
    next: {
      disabled: false,
      htmlText: ''
    },
  };

  /**
   * dot elements of the user interface.
   */
  protected _dotsData: DotsData = {
    disabled: false,
    dots: []
  };

  /**
   * Markup for an indicator.
   */
  protected _templates: string[] = [];

  constructor(private carouselService: CarouselService) {
    this.spyDataStreams();
  }

  /**
   * defines Observables which service must observe
   */
  spyDataStreams() {

    const initializedCarousel$: Observable<string> = this.carouselService.getInitializedState().pipe(
      tap(state => {
        this.initialize();
        this._updateNavPages();
        this.draw();
        this.update();
        this.carouselService.sendChanges();
      })
    );

    // mostly changes in carouselService and carousel at all causes carouselService.to(). It moves stage right-left by its code and calling needed functions
    // Thus this method by calling carouselService.current(position) notifies about changes
    const changedSettings$: Observable<string> = this.carouselService.getChangedState().pipe(
      tap(state => {
        this.update();
        // should be the call of the function written at the end of comment
        // but the method carouselServive.to() has setTimeout(f, 0) which contains carouselServive.update() which calls sendChanges() method.
        // carouselService.navData and carouselService.dotsData update earlier than carouselServive.update() gets called
        // updates of carouselService.navData and carouselService.dotsData are being happening withing carouselService.current(position) method which calls next() of _changedSettingsCarousel$
        // carouselService.current(position) is being calling earlier than carouselServive.update();
        // this.carouselService.sendChanges();
      })
    );

    const navMerge$: Observable<string> = merge(initializedCarousel$, changedSettings$);
    this.navSubscription = navMerge$.subscribe(
      () => {}
    );
  }

  /**
	 * Initializes the layout of the plugin and extends the carousel.
	 */
	initialize() {
    this._navData.disabled = true;
    this._navData.prev.htmlText = this.carouselService.settings.navText[0];
    this._navData.next.htmlText = this.carouselService.settings.navText[1];

    this._dotsData.disabled = true;

    this.carouselService.navData = this._navData;
    this.carouselService.dotsData = this._dotsData;
  }

  /**
   * calculates the internal state and updates prop _pages
   */
	private _updateNavPages() {
		let i, j, k;
		const lower = this.carouselService.clones().length / 2,
      upper = lower + this.carouselService.items().length,
      maximum = this.carouselService.maximum(true),
      pages = [],
      settings = this.carouselService.settings;
     let size = settings.center || settings.autoWidth || settings.dotsData
        ? 1 : settings.dotsEach || settings.items;
      size = +size;
		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(+settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy === 'page') {

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this.carouselService.mergers(this.carouselService.relative(i));
			}
		}
		this._pages = pages;
	}

  /**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 */
  draw() {
		let difference;
    const	settings = this.carouselService.settings,
      items = this.carouselService.items(),
      disabled = items.length <= settings.items;

		this._navData.disabled = !settings.nav || disabled;
		this._dotsData.disabled = !settings.dots || disabled;

		if (settings.dots) {
			difference = this._pages.length - this._dotsData.dots.length;

			if (settings.dotsData && difference !== 0) {
        items.forEach(item => {
          this._dotsData.dots.push({
            active: false,
            id: `dot-${item.id}`,
            innerContent: item.dotContent
          });
        });
			} else if (difference > 0) {
        for (let i = 0; i < difference; i++) {
          this._dotsData.dots.push({
            active: false,
            id: `dot-${i}`,
          });
        }
			} else if (difference < 0) {
        this._dotsData.dots.splice(difference, Math.abs(difference))
			}
    }

    this.carouselService.navData = this._navData;
    this.carouselService.dotsData = this._dotsData;
  };

  /**
   * updates navigation buttons's and dots's states
   */
  update() {
    this._updateNavButtons();
    this._updateDots();
  }

  /**
   * changes state of nav buttons (disabled, enabled)
   */
  private _updateNavButtons() {
    const	settings = this.carouselService.settings,
      loop = settings.loop || settings.rewind,
      index = this.carouselService.relative(this.carouselService.current());

    if (settings.nav) {
      this._navData.prev.disabled = !loop && index <= this.carouselService.minimum(true);
			this._navData.next.disabled = !loop && index >= this.carouselService.maximum(true);
    }

    this.carouselService.navData = this._navData;
  }

  /**
   * changes active dot if page becomes changed
   */
  private _updateDots() {
    let curActiveDotI: number;
    this._dotsData.dots.forEach(item => {
      if (item.active === true) {
        item.active = false;
      }
    })

    curActiveDotI = this._current();
    if (this._dotsData.dots.length) {
      this._dotsData.dots[curActiveDotI].active = true;
    }
    this.carouselService.dotsData = this._dotsData;
  }

  /**
	 * Gets the current page position of the carousel.
	 * @returns the current page position of the carousel
	 */
	private _current(): any {
    const current = this.carouselService.relative(this.carouselService.current());
    let finalCurrent: number;
    const pages: any = this._pages.filter((page, index) => {
      return page.start <= current && page.end >= current;
    }).pop();

    finalCurrent = this._pages.findIndex(page => {
      return page.start === pages.start && page.end === pages.end;
    });

    return finalCurrent;
  };

  /**
	 * Gets the current succesor/predecessor position.
	 * @returns the current succesor/predecessor position
	 */
	private _getPosition(successor): number {
		let position, length;
		const	settings = this.carouselService.settings;

		if (settings.slideBy === 'page') {
			position = this._current();
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this.carouselService.relative(this.carouselService.current());
			length = this.carouselService.items().length;
			successor ? position += settings.slideBy : position -= +settings.slideBy;
		}

		return position;
  };

  /**
	 * Slides to the next item or page.
	 * @param [speed=false] - The time in milliseconds for the transition.
	 */
	next(speed: number | boolean) {
    this.carouselService.to(this._getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @param [speed=false] - The time in milliseconds for the transition.
	 */
	prev(speed: number | boolean) {
    this.carouselService.to(this._getPosition(false), speed);
  };

 	/**
	 * Slides to the specified item or page.
	 * @param position - The position of the item or page.
	 * @param speed - The time in milliseconds for the transition.
	 * @param standard - Whether to use the standard behaviour or not. Default meaning false
	 */
	to(position: number, speed: number | boolean, standard?: boolean) {
		let length;
		if (!standard && this._pages.length) {
      length = this._pages.length;
      this.carouselService.to(this._pages[((position % length) + length) % length].start, speed);
		} else {
      this.carouselService.to(position, speed);
		}
  };

  moveByDot(dotId: string) {
    const index = this._dotsData.dots.findIndex(dot => dotId === dot.id);
    this.to(index, this.carouselService.settings.dotsSpeed);
  }

}
